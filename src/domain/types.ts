// Domain types for NodeMix Canvas.
//
// These types describe the core data model: Track, TrackNode,
// TransitionEdge, and Project. They are pure data and must not depend
// on React or any UI library, so the model stays easy to serialize as
// JSON and reason about on its own.
//
// Source of truth: docs/04_domain_model.md

/**
 * A Track represents an audio item and its metadata.
 * It describes the music itself, not its placement on the canvas.
 */
export type Track = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string;
  durationSec?: number;
  audioUrl?: string;
  tags: string[];
};

/**
 * A TrackNode represents a Track placed on the canvas.
 * It references a Track by id and stores its visual position.
 */
export type TrackNode = {
  id: string;
  trackId: string;
  x: number;
  y: number;
  label: string;
  color?: string;
};

/**
 * How playback moves from one node to the next.
 * - cut: stop the first track and start the second immediately.
 * - fade: fade out the first track, then start the second.
 * - crossfade: fade out the first while fading in the second.
 */
export type TransitionType = "cut" | "fade" | "crossfade";

/**
 * A TransitionEdge connects two TrackNodes as a directed transition.
 * fadeDurationSec is required: use 0 for cut, a positive number otherwise.
 *
 * Phase 20: the transition is a window of fadeDurationSec seconds. The two
 * optional positions say where that window sits in each track; unset means
 * the pre-Phase-20 behaviour, so older project JSON plays unchanged.
 */
export type TransitionEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transitionType: TransitionType;
  fadeDurationSec: number;
  note?: string;
  /**
   * Seconds into the FROM track where the window starts (where playback
   * leaves it). Unset: one fade before the end, or the end for cut.
   */
  exitAtSec?: number;
  /**
   * Seconds into the TO track that plays when the window starts (where
   * playback comes in). Unset: the start of the track.
   */
  enterAtSec?: number;
};

/**
 * A Project contains the full music graph and is the unit of save/load.
 * It should remain serializable as plain JSON.
 */
export type Project = {
  id: string;
  title: string;
  tracks: Track[];
  nodes: TrackNode[];
  edges: TransitionEdge[];
  createdAt?: string;
  updatedAt?: string;
};
