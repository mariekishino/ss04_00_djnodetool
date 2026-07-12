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
