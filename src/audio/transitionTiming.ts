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
// Phase 12 adds transitionTriggerOffset, the rule for WHEN sequential playback
// leaves a track. Phase 9's rules describe how a transition sounds; this one
// describes when it starts.

import type { TransitionType } from "../domain/types";

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

/**
 * How long after a track starts sequential playback should trigger the
 * transition to the next track, in seconds.
 *
 * - cut: at the very end, so the next track starts as this one finishes.
 * - fade / crossfade: `fadeSec` before the end, so the fade-out (and, for
 *   crossfade, the overlap) covers the track's final seconds.
 *
 * A fade longer than the track clamps to 0: the transition starts at once
 * rather than at a negative time.
 */
export function transitionTriggerOffset(
  durationSec: number,
  transitionType: TransitionType,
  fadeSec: number,
): number {
  // Guard against NaN/Infinity/negative durations from odd metadata.
  const duration =
    Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  if (transitionType === "cut") {
    return duration;
  }
  return Math.max(0, duration - sanitizeFadeDuration(fadeSec));
}
