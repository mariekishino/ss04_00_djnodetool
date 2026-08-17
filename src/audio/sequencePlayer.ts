// SequencePlayer walks the node graph during playback.
//
// Phase 12: it plays a node, waits until the transition point, then hands
// over to the next node along the first outgoing edge, and repeats. It owns
// the stepping (timer + current node + step count) and calls the AudioEngine
// for the sound; it never touches the Web Audio API or React itself.
//
// Scheduling is step by step: each step sets a timer for the next one instead
// of scheduling the whole chain up front. Stopping is then just "cancel the
// pending timer", and the sequence always reflects the latest step.
//
// The graph is a snapshot taken when playback starts: editing nodes or edges
// mid-playback does not reroute a running sequence (restart to pick up edits).

import type { TrackNode, TransitionEdge } from "../domain/types";
import { findNextEdge } from "../domain/playbackSequence";
import { AudioEngine } from "./audioEngine";
import {
  transitionTriggerOffset,
  sanitizeFadeDuration,
} from "./transitionTiming";

// A cycle (A -> B -> A) is allowed to keep playing until the user stops it.
// This cap only exists so a runaway chain cannot schedule forever.
const MAX_SEQUENCE_STEPS = 100;

/**
 * How the sequence reports itself to the UI.
 * - onNowPlaying: the node now playing, or null when the sequence ends.
 * - onTransitionEdge: the edge being crossed while its fade lasts, then null.
 *   It changes twice per handover, so the UI can hold it in plain state.
 */
type SequenceListeners = {
  onNowPlaying: (nodeId: string | null) => void;
  onTransitionEdge: (edgeId: string | null) => void;
};

export class SequencePlayer {
  private engine: AudioEngine;
  private listeners: SequenceListeners;

  // The graph snapshot for the running sequence, empty when stopped.
  private nodes: TrackNode[] = [];
  private edges: TransitionEdge[] = [];

  // The pending timer for the next step, or null when nothing is scheduled.
  private timerId: number | null = null;

  // The timer that ends the "crossing this edge" report once the fade is over.
  // Separate from timerId because it runs alongside the next step's timer.
  private transitionTimerId: number | null = null;

  // How many nodes this sequence has played, for the runaway guard.
  private stepCount = 0;

  // The step playing right now, kept so a seek can reschedule the hand-over
  // from the new position. Null when no sequence is running.
  private currentStep: { node: TrackNode; durationSec: number } | null = null;

  constructor(engine: AudioEngine, listeners: SequenceListeners) {
    this.engine = engine;
    this.listeners = listeners;
  }

  /**
   * Start playing at startNode and follow edges from there. Any previous
   * sequence (or single-node playback) is stopped first.
   */
  start(
    nodes: TrackNode[],
    edges: TransitionEdge[],
    startNode: TrackNode,
  ): void {
    this.stop();
    // Snapshot the graph so later edits cannot reroute this sequence.
    this.nodes = nodes;
    this.edges = edges;
    this.stepCount = 1;

    const { durationSec } = this.engine.startNode(startNode);
    this.listeners.onNowPlaying(startNode.id);
    this.scheduleNextStep(startNode, durationSec);
  }

  /** Whether a sequence is running, so a seek knows where to go. */
  isRunning(): boolean {
    return this.currentStep !== null;
  }

  /** The node the sequence is playing, or null when it is not running. */
  currentNodeId(): string | null {
    return this.currentStep?.node.id ?? null;
  }

  /**
   * Move within the step that is playing and reschedule the hand-over from
   * what is left of the track. Does nothing when no sequence is running.
   */
  seek(offsetSec: number): void {
    const step = this.currentStep;
    if (!step) return;

    this.engine.playNode(step.node, offsetSec);
    this.scheduleNextStep(step.node, step.durationSec, offsetSec);
  }

  /** Stop the sequence and its audio. Safe to call when nothing is playing. */
  stop(): void {
    this.clearTimer();
    this.clearTransitionTimer();
    this.nodes = [];
    this.edges = [];
    this.stepCount = 0;
    this.currentStep = null;
    this.engine.stop();
    this.listeners.onNowPlaying(null);
    this.listeners.onTransitionEdge(null);
  }

  // Work out when this node hands over (or simply ends) and set the timer.
  //
  // playedSec is how much of the track has already gone by, which is 0 for a
  // step that just started and the seek position after a seek. Timers are set
  // from what remains, not from the start of the track.
  private scheduleNextStep(
    node: TrackNode,
    durationSec: number,
    playedSec = 0,
  ): void {
    this.currentStep = { node, durationSec };
    const edge = findNextEdge(this.edges, node.id);
    const nextNode = edge
      ? (this.nodes.find((candidate) => candidate.id === edge.toNodeId) ?? null)
      : null;

    // No outgoing edge, a dangling edge, or the guard reached: let this node
    // finish, then end the sequence.
    if (!edge || !nextNode || this.stepCount >= MAX_SEQUENCE_STEPS) {
      this.setTimer(() => this.stop(), durationSec - playedSec);
      return;
    }

    const triggerAtSec = transitionTriggerOffset(
      durationSec,
      edge.transitionType,
      edge.fadeDurationSec,
    );
    this.setTimer(
      () => this.advanceTo(edge, nextNode),
      triggerAtSec - playedSec,
    );
  }

  // Hand over to the next node and schedule the step after it.
  private advanceTo(edge: TransitionEdge, nextNode: TrackNode): void {
    this.stepCount += 1;
    const { durationSec } = this.engine.transitionToNode(edge, nextNode);
    this.listeners.onNowPlaying(nextNode.id);
    this.reportTransition(edge);
    this.scheduleNextStep(nextNode, durationSec);
  }

  // Report the edge as being crossed, and stop reporting it once the fade
  // that defines the handover is over.
  private reportTransition(edge: TransitionEdge): void {
    this.clearTransitionTimer();
    this.listeners.onTransitionEdge(edge.id);

    const fadeSec = sanitizeFadeDuration(edge.fadeDurationSec);
    this.transitionTimerId = window.setTimeout(() => {
      this.transitionTimerId = null;
      this.listeners.onTransitionEdge(null);
    }, fadeSec * 1000);
  }

  private setTimer(callback: () => void, delaySec: number): void {
    this.clearTimer();
    this.timerId = window.setTimeout(
      () => {
        this.timerId = null;
        callback();
      },
      Math.max(0, delaySec) * 1000,
    );
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private clearTransitionTimer(): void {
    if (this.transitionTimerId !== null) {
      window.clearTimeout(this.transitionTimerId);
      this.transitionTimerId = null;
    }
  }
}
