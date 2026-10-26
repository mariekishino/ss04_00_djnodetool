// Pure rules for editing a TransitionEdge from the UI.
//
// Kept free of React so they can be unit tested and reused. The rules for
// keeping transitionType and fadeDurationSec consistent were agreed in
// docs/10_decision_log.md and docs/05_ui_requirements.md:
// - "cut" is instant, so its fade duration is always 0.
// - "fade" / "crossfade" with a 0 fade would be inaudible, so switching to
//   them from a 0 fade resets the duration to a default.

import type { TransitionEdge, TransitionType } from "./types";

// Default fade length in seconds. Used for newly created edges and when a
// 0-fade edge is switched to "fade" / "crossfade".
export const DEFAULT_FADE_SECONDS = 3;

// Return a copy of the edge with the new transition type, keeping
// fadeDurationSec consistent with the rules above.
export function changeTransitionType(
  edge: TransitionEdge,
  transitionType: TransitionType,
): TransitionEdge {
  if (transitionType === "cut") {
    return { ...edge, transitionType, fadeDurationSec: 0 };
  }
  const fadeDurationSec =
    edge.fadeDurationSec === 0 ? DEFAULT_FADE_SECONDS : edge.fadeDurationSec;
  return { ...edge, transitionType, fadeDurationSec };
}

// Phase 20: the two transition positions. A position is clamped into the
// track it belongs to, so the duration of that track is passed in (like the
// node size in nodeLayout.ts) rather than looked up here: Track.durationSec
// is not reliably saved yet, and the caller knows the decoded audio's length.
//
// Non-finite input (an emptied number field) clears the position back to its
// default, which is how the user resets it. Positions are kept to 10 ms: a
// waveform click lands on a fraction of a pixel, and the long float it
// produces is noise in the saved JSON and in the input field.

type PositionField = "exitAtSec" | "enterAtSec";

// Steps per second: 100 means 10 ms. Rounding is done by multiplying and
// dividing by this integer, which lands on a clean decimal (6087 / 100 is
// exactly 60.87) where multiplying by 0.01 would not.
const POSITION_STEPS_PER_SECOND = 100;

function clampPosition(
  seconds: number,
  durationSec: number,
): number | undefined {
  if (!Number.isFinite(seconds)) return undefined;
  const max = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0;
  const clamped = Math.min(Math.max(0, seconds), max);
  return (
    Math.round(clamped * POSITION_STEPS_PER_SECOND) / POSITION_STEPS_PER_SECOND
  );
}

function withPosition(
  edge: TransitionEdge,
  field: PositionField,
  value: number | undefined,
): TransitionEdge {
  const next = { ...edge };
  if (value === undefined) {
    // Drop the key rather than storing undefined, so the saved JSON stays
    // free of the field when it is at its default.
    delete next[field];
  } else {
    next[field] = value;
  }
  return next;
}

// Return a copy of the edge with a new exit position in the FROM track.
export function changeExitPosition(
  edge: TransitionEdge,
  seconds: number,
  fromDurationSec: number,
): TransitionEdge {
  return withPosition(edge, "exitAtSec", clampPosition(seconds, fromDurationSec));
}

// Return a copy of the edge with a new enter position in the TO track.
export function changeEnterPosition(
  edge: TransitionEdge,
  seconds: number,
  toDurationSec: number,
): TransitionEdge {
  return withPosition(edge, "enterAtSec", clampPosition(seconds, toDurationSec));
}

// Return a copy of the edge with a new fade duration.
// - A "cut" edge always keeps 0 (the fade field is meaningless for it).
// - Non-finite input (e.g. an emptied number field parsing to NaN) and
//   negative values clamp to 0.
export function changeFadeDuration(
  edge: TransitionEdge,
  seconds: number,
): TransitionEdge {
  if (edge.transitionType === "cut") {
    return { ...edge, fadeDurationSec: 0 };
  }
  const fadeDurationSec =
    Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return { ...edge, fadeDurationSec };
}
