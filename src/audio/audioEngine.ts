// AudioEngine: the only place that talks to the Web Audio API.
//
// The UI calls a small high-level API (playNode / playTransition / stop /
// dispose) and never sees oscillators, gains, or the AudioContext. This keeps
// audio logic out of React components (see docs/06_audio_engine_requirements).
//
// Phase 8: simple playback using an OscillatorNode as a placeholder source.
// Phase 9: transition playback (cut / fade / crossfade) between a source node
// and a target node. The wiring is still `source -> gain -> destination`, now
// with one such chain per active voice, so crossfade can play two at once.
//
// Phase 11: real audio. importTrackAudio decodes a picked file into the
// TrackAudioStore, and createSourceForNode (the swap point promised in the
// Phase 8 comment) plays that buffer when the node's track has one; tracks
// without imported audio keep the oscillator placeholder. The transition
// logic is unchanged: both source types are AudioScheduledSourceNodes.
//
// Phase 12: primitives for sequential playback. startNode and transitionToNode
// are the pieces SequencePlayer chains together. Unlike playNode /
// playTransition (one-shot previews that stop everything first),
// transitionToNode keeps the outgoing track playing and fades it out, so one
// track can hand over to the next without a gap.
//
// Phase 20: transition positions. A hand-over now happens at a chosen point
// in the outgoing track and enters the incoming track at a chosen offset. The
// audio path (source -> gain -> destination) is unchanged; what changed is the
// control side: every gain movement goes through one rampGain call, and every
// transition type goes through one handOver driven by the numbers in
// transitionShape, instead of a per-type branch in each play method. The
// preview (playTransition) starts a few seconds before the exit point so the
// hand-over can be heard without waiting for the track to end.

import type { TransitionEdge, TrackNode } from "../domain/types";
import { TrackAudioStore } from "./trackAudioStore";
import type { PlaybackProgress } from "./playbackProgress";
import { soundForNode } from "./nodeSound";
import {
  resolveTransitionPoints,
  transitionShape,
  MIN_FADE_SECONDS,
  PLACEHOLDER_NODE_SECONDS,
} from "./transitionTiming";

// A playing voice: a source plus its own gain, kept together so stop() can ramp
// the gain down and disconnect both. Crossfade has two voices at once, so the
// engine tracks a list of them.
type Voice = {
  source: AudioScheduledSourceNode;
  gain: GainNode;
};

// Short ramp times (seconds) so notes don't click on start/stop.
const ATTACK_SECONDS = 0.02;
const RELEASE_SECONDS = 0.05;
// Steady-state volume while a note plays (kept below 1 to avoid harshness).
const PLAY_GAIN = 0.2;
// A little extra time after a scheduled fade before the source is stopped.
const STOP_PADDING_SECONDS = 0.02;
// How much of the outgoing track a transition preview plays before the
// hand-over, so the listener hears the exit point arrive.
export const PREVIEW_LEAD_SECONDS = 5;

// One node's playback as the progress display sees it. startedAtSec is on the
// AudioContext clock and is backdated by any offset the track started at, so
// `currentTime - startedAtSec` is the position in the track. audibleFromSec is
// when this node actually begins to sound: a `fade` target, or the target of a
// preview, is scheduled ahead of time, and until then the previous node is
// still the one to show.
type ScheduledPlayback = {
  nodeId: string;
  startedAtSec: number;
  audibleFromSec: number;
  durationSec: number;
};

export class AudioEngine {
  // Where decoded audio lives, keyed by trackId. Owned by App and shared with
  // the future Analyzer side, so it is passed in rather than created here.
  private trackAudio: TrackAudioStore;

  // Created lazily on the first play or import call, which must be a user
  // gesture so the browser allows audio. Null until then.
  private context: AudioContext | null = null;

  constructor(trackAudio: TrackAudioStore) {
    this.trackAudio = trackAudio;
  }

  // Every voice currently scheduled or playing. playNode adds one; a crossfade
  // adds two. stop() clears them all.
  private activeVoices: Voice[] = [];

  // Phase 13 / 20: what the progress display reads. Each real-track start is
  // recorded here (placeholder oscillator nodes are not: their length is a
  // scheduling device, not a position). playbackProgress() reports the entry
  // most recently become audible. stop() clears the list.
  private scheduledPlaybacks: ScheduledPlayback[] = [];

  // Lazily create (or resume) the AudioContext. Called from the play methods so
  // the context is only created in response to a user action.
  private ensureContext(): AudioContext {
    const context = this.getContext();
    // If a previous interaction left it suspended, resume it.
    if (context.state === "suspended") {
      void context.resume();
    }
    return context;
  }

  // The AudioContext without resuming it. Creating one outside a user gesture
  // is allowed (it just starts suspended); resuming one is not. Decoding works
  // on a suspended context, so loading audio at startup goes through here.
  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    return this.context;
  }

  // Decode audio bytes into the TrackAudioStore. Decoding happens once, at
  // load time; playback never decodes. Shared by the two sources of bytes:
  // a picked file and a URL served by the local server.
  private async decodeInto(
    trackId: string,
    encoded: ArrayBuffer,
  ): Promise<{ durationSec: number }> {
    // decodeAudioData rejects on undecodable input; the caller reports it.
    const buffer = await this.getContext().decodeAudioData(encoded);
    this.trackAudio.set(trackId, buffer);
    return { durationSec: buffer.duration };
  }

  // Load a track's audio from a picked file (MP3/WAV/...).
  async importTrackAudio(
    trackId: string,
    file: File,
  ): Promise<{ durationSec: number }> {
    return this.decodeInto(trackId, await file.arrayBuffer());
  }

  // Load a track's audio from a URL, i.e. a file served by the local server.
  // Phase 14: this is what makes audio survive a reload — the project stores
  // the URL, and the audio is fetched again on startup.
  async loadTrackAudioFromUrl(
    trackId: string,
    url: string,
  ): Promise<{ durationSec: number }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not fetch audio (${response.status}).`);
    }
    return this.decodeInto(trackId, await response.arrayBuffer());
  }

  // Create the audio source for a node. This is the single swap point: when
  // the node's track has imported audio, play that buffer; otherwise fall back
  // to the oscillator placeholder. The rest of the engine and the UI see only
  // an AudioScheduledSourceNode either way.
  private createSourceForNode(
    context: AudioContext,
    node: TrackNode,
  ): AudioScheduledSourceNode {
    const buffer = this.trackAudio.get(node.trackId);
    if (buffer) {
      const bufferSource = context.createBufferSource();
      bufferSource.buffer = buffer;
      return bufferSource;
    }

    const { frequency, waveform } = soundForNode(node);
    const oscillator = context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = frequency;
    return oscillator;
  }

  // Build one voice for a node, wire it as source -> gain -> destination, start
  // it at startAtSec from offsetSec into the track, bring it in over rampSec,
  // and track it.
  private startVoice(
    node: TrackNode,
    startAtSec: number,
    offsetSec: number,
    rampSec: number,
  ): Voice {
    const context = this.context!;
    const source = this.createSourceForNode(context, node);
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);
    // Silent until its ramp: starting at full gain would click.
    rampGain(gain, 0, PLAY_GAIN, startAtSec, rampSec);

    // Only a buffer has a position to start from; an oscillator just plays.
    if (offsetSec > 0 && source instanceof AudioBufferSourceNode) {
      source.start(startAtSec, offsetSec);
    } else {
      source.start(startAtSec);
    }
    const voice: Voice = { source, gain };
    this.activeVoices.push(voice);

    // When the source ends on its own (e.g. a scheduled stop after a fade),
    // disconnect it and drop it from the active list.
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.removeVoice(voice);
    };
    return voice;
  }

  private removeVoice(voice: Voice): void {
    const index = this.activeVoices.indexOf(voice);
    if (index !== -1) {
      this.activeVoices.splice(index, 1);
    }
  }

  // Play a single node's sound. Stops any current playback first, so only one
  // transition/voice set is active at a time. The voice plays until stop().
  // Phase 17: offsetSec starts the track partway in, which is how seeking
  // works — Web Audio cannot move a playing source, so a seek stops it and
  // starts a new one here.
  playNode(node: TrackNode, offsetSec = 0): void {
    const context = this.ensureContext();
    this.stop();

    const now = context.currentTime;
    this.startVoice(node, now, offsetSec, ATTACK_SECONDS);
    this.recordPlayback(node, now, offsetSec);
  }

  // Play a transition between two nodes as a preview. Stops any current
  // playback first. The outgoing track starts PREVIEW_LEAD_SECONDS before its
  // exit point (or at its start if the exit is earlier than that), the
  // hand-over happens at the exit point following the edge's type, and the
  // incoming track comes in at its enter point.
  playTransition(
    edge: TransitionEdge,
    sourceNode: TrackNode,
    targetNode: TrackNode,
  ): void {
    const context = this.ensureContext();
    this.stop();

    const now = context.currentTime;
    const { exitAtSec, enterAtSec } = resolveTransitionPoints(
      edge,
      this.durationForNode(sourceNode),
      this.durationForNode(targetNode),
    );
    const leadSec = Math.min(PREVIEW_LEAD_SECONDS, exitAtSec);
    const sourceOffsetSec = exitAtSec - leadSec;

    this.startVoice(sourceNode, now, sourceOffsetSec, MIN_FADE_SECONDS);
    this.recordPlayback(sourceNode, now, sourceOffsetSec);
    this.handOver(now + leadSec, edge, targetNode, enterAtSec);
  }

  // Remember that a real track starts playing, for the progress display.
  // Placeholder (oscillator) nodes have no position to report and are skipped.
  // startAtSec is when the track begins to sound; offsetSec is where in the
  // track it begins, which backdates the recorded start so the reported
  // position reads as the offset right away.
  private recordPlayback(
    node: TrackNode,
    startAtSec: number,
    offsetSec: number,
  ): void {
    const buffer = this.trackAudio.get(node.trackId);
    if (!buffer) return;
    // A new start supersedes anything scheduled at or after it.
    this.scheduledPlaybacks = this.scheduledPlaybacks.filter(
      (playback) => playback.audibleFromSec < startAtSec,
    );
    this.scheduledPlaybacks.push({
      nodeId: node.id,
      startedAtSec: startAtSec - offsetSec,
      audibleFromSec: startAtSec,
      durationSec: buffer.duration,
    });
  }

  /**
   * Where playback currently is, or null when nothing with a real position
   * is playing. Read repeatedly by the UI while it animates, so it stays a
   * cheap computation over plain numbers.
   */
  playbackProgress(): PlaybackProgress | null {
    if (!this.context) return null;
    const now = this.context.currentTime;
    // The entries are in schedule order, so the last audible one is current.
    let current: ScheduledPlayback | null = null;
    for (const playback of this.scheduledPlaybacks) {
      if (playback.audibleFromSec <= now) current = playback;
    }
    if (!current) return null;
    return {
      nodeId: current.nodeId,
      elapsedSec: now - current.startedAtSec,
      durationSec: current.durationSec,
    };
  }

  // How long a node plays before a sequence moves on: the imported audio's
  // own length, or the placeholder length for a node still using the
  // oscillator (which would otherwise never end).
  durationForNode(node: TrackNode): number {
    return (
      this.trackAudio.get(node.trackId)?.duration ?? PLACEHOLDER_NODE_SECONDS
    );
  }

  // Start one node as the beginning of a sequence: stop anything playing,
  // then bring the node in with a short ramp. Returns how long it will play,
  // so the caller can schedule the next step.
  startNode(node: TrackNode): { durationSec: number } {
    const context = this.ensureContext();
    this.stop();

    const now = context.currentTime;
    this.startVoice(node, now, 0, MIN_FADE_SECONDS);
    this.recordPlayback(node, now, 0);
    return { durationSec: this.durationForNode(node) };
  }

  // Hand over from whatever is playing to targetNode right now, following the
  // edge's transition type, with the target entering at enterAtSec into its
  // track. Unlike playTransition, the outgoing track is NOT restarted: it is
  // already playing, so it is only faded out. Returns the target's duration
  // for scheduling the step after this one.
  transitionToNode(
    edge: TransitionEdge,
    targetNode: TrackNode,
    enterAtSec: number,
  ): { durationSec: number } {
    const context = this.ensureContext();
    this.handOver(context.currentTime, edge, targetNode, enterAtSec);
    return { durationSec: this.durationForNode(targetNode) };
  }

  // The one hand-over: at atSec, fade every playing voice out and bring the
  // target in, using the three numbers transitionShape gives for the edge's
  // type. atSec may be in the future (the preview schedules ahead).
  private handOver(
    atSec: number,
    edge: TransitionEdge,
    targetNode: TrackNode,
    enterAtSec: number,
  ): void {
    const shape = transitionShape(edge.transitionType, edge.fadeDurationSec);
    this.fadeOutActiveVoices(atSec, shape.outgoingFadeSec);

    const targetStart = atSec + shape.incomingDelaySec;
    this.startVoice(targetNode, targetStart, enterAtSec, shape.incomingFadeSec);
    this.recordPlayback(targetNode, targetStart, enterAtSec);
  }

  // Fade every currently playing voice down to 0 over fadeSec from atSec and
  // schedule it to stop. The voices are dropped from the active list right
  // away so a new voice started in the same step is not caught by a later
  // fade-out.
  private fadeOutActiveVoices(atSec: number, fadeSec: number): void {
    const voices = this.activeVoices;
    this.activeVoices = [];

    for (const voice of voices) {
      // Ramp down from the steady playing level. atSec can be ahead of now,
      // where the gain's current value is not yet known, and by then every
      // attack ramp has long finished, so PLAY_GAIN is the right anchor.
      rampGain(voice.gain, PLAY_GAIN, 0, atSec, fadeSec);

      // The voice is no longer tracked; clean up when its source ends.
      voice.source.onended = () => {
        voice.source.disconnect();
        voice.gain.disconnect();
      };
      try {
        voice.source.stop(atSec + fadeSec + STOP_PADDING_SECONDS);
      } catch {
        // Stopping an already-stopped source can throw; ignore it.
      }
    }
  }

  // Stop all active voices with a short release ramp, then disconnect them so
  // old sources don't pile up. Safe to call when nothing is playing.
  stop(): void {
    const voices = this.activeVoices;
    this.activeVoices = [];
    // Nothing is playing, so there is no position to report.
    this.scheduledPlaybacks = [];
    if (!this.context) return;

    const now = this.context.currentTime;
    for (const { source, gain } of voices) {
      // Release ramp to 0 from wherever the gain is right now.
      rampGain(gain, gain.gain.value, 0, now, RELEASE_SECONDS);

      // Clear the handler so stopping here doesn't double-clean a voice.
      source.onended = null;
      try {
        source.stop(now + RELEASE_SECONDS);
      } catch {
        // Starting/stopping an already-stopped source can throw; ignore it.
      }
      // Disconnect after the release so the ramp can finish audibly.
      window.setTimeout(
        () => {
          source.disconnect();
          gain.disconnect();
        },
        Math.ceil(RELEASE_SECONDS * 1000) + 20,
      );
    }
  }

  // Release all audio resources. Called when the app unmounts.
  dispose(): void {
    this.stop();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}

// The one control function: move a gain from one value to another over a
// span of time. Anything scheduled on the gain from startAtSec on is replaced,
// and the start value is pinned at startAtSec so the ramp begins from a known
// level. A later stage that drives a filter instead of a gain will need the
// same shape against a different AudioParam.
function rampGain(
  gain: GainNode,
  fromValue: number,
  toValue: number,
  startAtSec: number,
  seconds: number,
): void {
  const param = gain.gain;
  param.cancelScheduledValues(startAtSec);
  param.setValueAtTime(fromValue, startAtSec);
  param.linearRampToValueAtTime(toValue, startAtSec + seconds);
}
