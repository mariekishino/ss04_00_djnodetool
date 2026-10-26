// Pure helpers for transition timing.
//
// Kept free of the Web Audio API so they can be unit tested. The AudioEngine
// uses sanitizeFadeDuration to turn a TransitionEdge.fadeDurationSec (which may
// be 0, negative, NaN, or Infinity in imported/edited data) into a safe value.
//
// Policy (Phase 9): abnormal values round down to a tiny fade (0.01s) so the
// transition is essentially instant. We prefer an almost-immediate transition
// over silently substituting a "natural" 3s, which would hide bad data.
//
// Phase 20: a transition is a window of `fadeDurationSec` seconds placed at
// two positions — where it leaves the outgoing track and where it enters the
// incoming one. resolveTransitionPoints turns an edge into those two concrete
// numbers (applying the defaults for unset positions), and transitionShape
// turns the transition type into the three numbers that drive the gains.
// Together they replace the per-type branches the engine used to carry.

import type { TransitionEdge, TransitionType } from "../domain/types";

// The smallest fade we allow. Also used for `cut`, which is effectively an
// instant transition with just enough ramp to avoid a click.
export const MIN_FADE_SECONDS = 0.01;

// An upper clamp so a huge or Infinity value cannot schedule an absurd ramp.
export const MAX_FADE_SECONDS = 60;

// Clamp fadeDurationSec to a safe, finite range. Anything that is not a finite
// number greater than MIN_FADE_SECONDS becomes MIN_FADE_SECONDS; values above
// MAX_FADE_SECONDS are capped.
export function sanitizeFadeDuration(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= MIN_FADE_SECONDS) {
    return MIN_FADE_SECONDS;
  }
  if (seconds > MAX_FADE_SECONDS) {
    return MAX_FADE_SECONDS;
  }
  return seconds;
}

// How long a node without imported audio plays before the sequence moves on.
// An oscillator has no natural end, so sequential playback needs a length to
// use for placeholder nodes.
export const PLACEHOLDER_NODE_SECONDS = 5;

// Durations from odd metadata (NaN, Infinity, negative) read as 0.
function safeDuration(durationSec: number): number {
  return Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
}

function clampToTrack(seconds: number, durationSec: number): number {
  return Math.min(Math.max(0, seconds), safeDuration(durationSec));
}

/** The concrete positions of one edge's transition window, in seconds. */
export type TransitionPoints = {
  /** Where in the outgoing track the window starts. */
  exitAtSec: number;
  /** Where in the incoming track playback comes in. */
  enterAtSec: number;
};

/**
 * Resolve an edge's transition positions against the two tracks' lengths.
 *
 * - exit: `edge.exitAtSec` when set; otherwise the pre-Phase-20 rule — the
 *   very end for `cut`, one fade before the end for `fade` / `crossfade`
 *   (clamped to 0 when the fade is longer than the track).
 * - enter: `edge.enterAtSec` when set; otherwise 0.
 *
 * Set positions are clamped into their track, so a position saved against a
 * longer file still plays rather than scheduling past the end.
 */
export function resolveTransitionPoints(
  edge: TransitionEdge,
  fromDurationSec: number,
  toDurationSec: number,
): TransitionPoints {
  const fromDuration = safeDuration(fromDurationSec);

  let exitAtSec: number;
  if (edge.exitAtSec !== undefined && Number.isFinite(edge.exitAtSec)) {
    exitAtSec = clampToTrack(edge.exitAtSec, fromDuration);
  } else if (edge.transitionType === "cut") {
    exitAtSec = fromDuration;
  } else {
    exitAtSec = Math.max(
      0,
      fromDuration - sanitizeFadeDuration(edge.fadeDurationSec),
    );
  }

  const enterAtSec =
    edge.enterAtSec !== undefined && Number.isFinite(edge.enterAtSec)
      ? clampToTrack(edge.enterAtSec, toDurationSec)
      : 0;

  return { exitAtSec, enterAtSec };
}

/**
 * The three numbers that make a transition sound like its type, all in
 * seconds from the moment the window opens:
 *
 * - outgoingFadeSec: how long the outgoing track takes to reach silence.
 * - incomingDelaySec: how long after the window opens the incoming track
 *   starts.
 * - incomingFadeSec: how long the incoming track takes to reach full volume
 *   once it starts.
 *
 * | type      | outgoing fade | incoming delay | incoming fade |
 * |-----------|---------------|----------------|---------------|
 * | cut       | MIN           | 0              | MIN           |
 * | fade      | fade          | fade           | MIN           |
 * | crossfade | fade          | 0              | fade          |
 *
 * This is the "volume curve as data" form: a later stage that adds more
 * curves (or drives a filter instead of a gain) extends this table rather
 * than the engine.
 */
export type TransitionShape = {
  outgoingFadeSec: number;
  incomingDelaySec: number;
  incomingFadeSec: number;
};

export function transitionShape(
  transitionType: TransitionType,
  fadeDurationSec: number,
): TransitionShape {
  const fade = sanitizeFadeDuration(fadeDurationSec);
  switch (transitionType) {
    case "cut":
      return {
        outgoingFadeSec: MIN_FADE_SECONDS,
        incomingDelaySec: 0,
        incomingFadeSec: MIN_FADE_SECONDS,
      };
    case "fade":
      return {
        outgoingFadeSec: fade,
        incomingDelaySec: fade,
        incomingFadeSec: MIN_FADE_SECONDS,
      };
    case "crossfade":
      return { outgoingFadeSec: fade, incomingDelaySec: 0, incomingFadeSec: fade };
  }
}

/** Where a transition window sits along a track, as 0..1 of its length. */
export type WindowRatios = {
  startRatio: number;
  endRatio: number;
};

/**
 * The window's span along one track for drawing on its waveform: it opens at
 * `startSec` and lasts `fadeSec`. Both ends clamp into 0..1, and a track
 * without a usable duration gives null (nothing to draw against).
 */
export function windowRatios(
  startSec: number,
  fadeSec: number,
  durationSec: number,
): WindowRatios | null {
  const duration = safeDuration(durationSec);
  if (duration === 0) return null;
  const startRatio = clampToTrack(startSec, duration) / duration;
  const endRatio =
    clampToTrack(startSec + sanitizeFadeDuration(fadeSec), duration) / duration;
  return { startRatio, endRatio };
}
