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
// This transition is a PREVIEW between a source node and a target node, not a
// full DJ transition from a currently-playing track.
//
// Phase 11: real audio. importTrackAudio decodes a picked file into the
// TrackAudioStore, and createSourceForNode (the swap point promised in the
// Phase 8 comment) plays that buffer when the node's track has one; tracks
// without imported audio keep the oscillator placeholder. The transition
// logic is unchanged: both source types are AudioScheduledSourceNodes.

import type { TransitionEdge, TrackNode } from "../domain/types";
import { TrackAudioStore } from "./trackAudioStore";
import { soundForNode } from "./nodeSound";
import { sanitizeFadeDuration, MIN_FADE_SECONDS } from "./transitionTiming";

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

  // Lazily create (or resume) the AudioContext. Called from the play methods so
  // the context is only created in response to a user action.
  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }
    // If a previous interaction left it suspended, resume it.
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  // Decode a picked audio file (MP3/WAV/...) and keep the result in the
  // TrackAudioStore. Decoding happens once here, at import time; playback
  // never decodes. Called from the file-pick handler, a user gesture, so
  // creating the AudioContext here is allowed.
  async importTrackAudio(
    trackId: string,
    file: File,
  ): Promise<{ durationSec: number }> {
    const context = this.ensureContext();
    const encoded = await file.arrayBuffer();
    // decodeAudioData rejects on undecodable input; the caller reports it.
    const buffer = await context.decodeAudioData(encoded);
    this.trackAudio.set(trackId, buffer);
    return { durationSec: buffer.duration };
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
  // it at startAtSec, and track it. The caller schedules the gain envelope. The
  // gain starts at 0 so the caller can ramp it up without a click.
  private startVoice(node: TrackNode, startAtSec: number): Voice {
    const context = this.context!;
    const source = this.createSourceForNode(context, node);
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0, startAtSec);

    source.start(startAtSec);
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
  playNode(node: TrackNode): void {
    const context = this.ensureContext();
    this.stop();

    const now = context.currentTime;
    const voice = this.startVoice(node, now);
    // Attack ramp from 0 to PLAY_GAIN to avoid a click.
    voice.gain.gain.linearRampToValueAtTime(PLAY_GAIN, now + ATTACK_SECONDS);
  }

  // Play a transition between two nodes as a preview. Stops any current
  // playback first. The behavior depends on edge.transitionType:
  // - cut: play the target immediately (the source is not played).
  // - fade: fade the source out, then play the target.
  // - crossfade: play both, ramping source 1->0 and target 0->1 together.
  playTransition(
    edge: TransitionEdge,
    sourceNode: TrackNode,
    targetNode: TrackNode,
  ): void {
    const context = this.ensureContext();
    this.stop();

    const now = context.currentTime;
    const fade = sanitizeFadeDuration(edge.fadeDurationSec);

    switch (edge.transitionType) {
      case "cut": {
        // Immediate switch: target only, with a tiny fade-in to avoid a click.
        this.rampIn(this.startVoice(targetNode, now), now, MIN_FADE_SECONDS);
        break;
      }
      case "fade": {
        // Source fades out over `fade`; the target starts once it finishes.
        const source = this.startVoice(sourceNode, now);
        this.rampInThenOut(source, now, fade);
        this.scheduleStop(source, now + fade);

        const targetStart = now + fade;
        this.rampIn(
          this.startVoice(targetNode, targetStart),
          targetStart,
          MIN_FADE_SECONDS,
        );
        break;
      }
      case "crossfade": {
        // Both play at once: source 1->0 while target 0->1 over `fade`.
        const source = this.startVoice(sourceNode, now);
        this.rampInThenOut(source, now, fade);
        this.scheduleStop(source, now + fade);

        this.rampIn(this.startVoice(targetNode, now), now, fade);
        break;
      }
    }
  }

  // Ramp a voice's gain from 0 up to PLAY_GAIN over rampSec.
  private rampIn(voice: Voice, startAtSec: number, rampSec: number): void {
    voice.gain.gain.linearRampToValueAtTime(PLAY_GAIN, startAtSec + rampSec);
  }

  // Quickly ramp up to PLAY_GAIN (to avoid a click) then down to 0 over fadeSec.
  private rampInThenOut(
    voice: Voice,
    startAtSec: number,
    fadeSec: number,
  ): void {
    voice.gain.gain.linearRampToValueAtTime(
      PLAY_GAIN,
      startAtSec + MIN_FADE_SECONDS,
    );
    voice.gain.gain.linearRampToValueAtTime(0, startAtSec + fadeSec);
  }

  // Stop a source a little after the given time so its fade can finish.
  private scheduleStop(voice: Voice, atSec: number): void {
    try {
      voice.source.stop(atSec + STOP_PADDING_SECONDS);
    } catch {
      // Stopping an already-stopped source can throw; ignore it.
    }
  }

  // Stop all active voices with a short release ramp, then disconnect them so
  // old sources don't pile up. Safe to call when nothing is playing.
  stop(): void {
    const voices = this.activeVoices;
    this.activeVoices = [];
    if (!this.context) return;

    const now = this.context.currentTime;
    for (const { source, gain } of voices) {
      // Release ramp to 0 from the current value.
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS);

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
