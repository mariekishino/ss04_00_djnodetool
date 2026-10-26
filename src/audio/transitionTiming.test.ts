// Unit tests for the pure transition-timing helpers.

import { describe, it, expect } from "vitest";
import type { TransitionEdge } from "../domain/types";
import {
  sanitizeFadeDuration,
  resolveTransitionPoints,
  transitionShape,
  windowRatios,
  MIN_FADE_SECONDS,
  MAX_FADE_SECONDS,
} from "./transitionTiming";

function makeEdge(overrides: Partial<TransitionEdge> = {}): TransitionEdge {
  return {
    id: "edge-1",
    fromNodeId: "node-a",
    toNodeId: "node-b",
    transitionType: "crossfade",
    fadeDurationSec: 3,
    ...overrides,
  };
}

describe("sanitizeFadeDuration", () => {
  it("keeps a normal positive value", () => {
    expect(sanitizeFadeDuration(3)).toBe(3);
    expect(sanitizeFadeDuration(5)).toBe(5);
  });

  it("rounds zero and negatives to the minimum fade", () => {
    expect(sanitizeFadeDuration(0)).toBe(MIN_FADE_SECONDS);
    expect(sanitizeFadeDuration(-3)).toBe(MIN_FADE_SECONDS);
  });

  it("rounds NaN and Infinity to the minimum fade", () => {
    expect(sanitizeFadeDuration(Number.NaN)).toBe(MIN_FADE_SECONDS);
    expect(sanitizeFadeDuration(Number.POSITIVE_INFINITY)).toBe(
      MIN_FADE_SECONDS,
    );
    expect(sanitizeFadeDuration(Number.NEGATIVE_INFINITY)).toBe(
      MIN_FADE_SECONDS,
    );
  });

  it("caps very large values at the maximum fade", () => {
    expect(sanitizeFadeDuration(1000)).toBe(MAX_FADE_SECONDS);
  });

  it("treats a value at the minimum boundary as the minimum", () => {
    expect(sanitizeFadeDuration(MIN_FADE_SECONDS)).toBe(MIN_FADE_SECONDS);
  });
});

describe("resolveTransitionPoints: defaults (positions unset)", () => {
  it("leaves a cut at the very end of the track", () => {
    const edge = makeEdge({ transitionType: "cut", fadeDurationSec: 0 });
    expect(resolveTransitionPoints(edge, 30, 200).exitAtSec).toBe(30);
    // A cut ignores any fade value it is given.
    const odd = makeEdge({ transitionType: "cut", fadeDurationSec: 5 });
    expect(resolveTransitionPoints(odd, 30, 200).exitAtSec).toBe(30);
  });

  it("leaves a fade and a crossfade one fade before the end", () => {
    const fade = makeEdge({ transitionType: "fade", fadeDurationSec: 3 });
    expect(resolveTransitionPoints(fade, 30, 200).exitAtSec).toBe(27);
    const crossfade = makeEdge({ transitionType: "crossfade" });
    expect(resolveTransitionPoints(crossfade, 30, 200).exitAtSec).toBe(27);
  });

  it("clamps to 0 when the fade is longer than the track", () => {
    const edge = makeEdge({ fadeDurationSec: 5 });
    expect(resolveTransitionPoints(edge, 2, 200).exitAtSec).toBe(0);
  });

  it("sanitizes the fade before subtracting it", () => {
    const edge = makeEdge({ transitionType: "fade", fadeDurationSec: 0 });
    expect(resolveTransitionPoints(edge, 10, 200).exitAtSec).toBe(
      10 - MIN_FADE_SECONDS,
    );
  });

  it("enters the incoming track at its start", () => {
    expect(resolveTransitionPoints(makeEdge(), 30, 200).enterAtSec).toBe(0);
  });

  it("treats an invalid outgoing duration as zero", () => {
    const cut = makeEdge({ transitionType: "cut" });
    expect(resolveTransitionPoints(cut, Number.NaN, 200).exitAtSec).toBe(0);
    expect(resolveTransitionPoints(makeEdge(), -5, 200).exitAtSec).toBe(0);
  });
});

describe("resolveTransitionPoints: explicit positions", () => {
  it("passes set positions through", () => {
    const edge = makeEdge({ exitAtSec: 42, enterAtSec: 12.5 });
    expect(resolveTransitionPoints(edge, 180, 200)).toEqual({
      exitAtSec: 42,
      enterAtSec: 12.5,
    });
  });

  it("clamps each position into its own track", () => {
    const edge = makeEdge({ exitAtSec: 500, enterAtSec: 500 });
    expect(resolveTransitionPoints(edge, 180, 200)).toEqual({
      exitAtSec: 180,
      enterAtSec: 200,
    });
    const negative = makeEdge({ exitAtSec: -1, enterAtSec: -1 });
    expect(resolveTransitionPoints(negative, 180, 200)).toEqual({
      exitAtSec: 0,
      enterAtSec: 0,
    });
  });

  it("falls back to the default for a non-finite stored position", () => {
    const edge = makeEdge({ exitAtSec: Number.NaN, enterAtSec: Number.NaN });
    expect(resolveTransitionPoints(edge, 30, 200)).toEqual({
      exitAtSec: 27,
      enterAtSec: 0,
    });
  });

  it("does not depend on the type once the exit is set", () => {
    const cut = makeEdge({ transitionType: "cut", exitAtSec: 10 });
    expect(resolveTransitionPoints(cut, 30, 200).exitAtSec).toBe(10);
  });
});

describe("transitionShape", () => {
  it("makes a cut instant on both sides", () => {
    expect(transitionShape("cut", 0)).toEqual({
      outgoingFadeSec: MIN_FADE_SECONDS,
      incomingDelaySec: 0,
      incomingFadeSec: MIN_FADE_SECONDS,
    });
  });

  it("makes a fade wait for the outgoing track to finish", () => {
    expect(transitionShape("fade", 3)).toEqual({
      outgoingFadeSec: 3,
      incomingDelaySec: 3,
      incomingFadeSec: MIN_FADE_SECONDS,
    });
  });

  it("makes a crossfade overlap both ramps", () => {
    expect(transitionShape("crossfade", 3)).toEqual({
      outgoingFadeSec: 3,
      incomingDelaySec: 0,
      incomingFadeSec: 3,
    });
  });

  it("sanitizes the fade it is given", () => {
    expect(transitionShape("crossfade", -1).outgoingFadeSec).toBe(
      MIN_FADE_SECONDS,
    );
    expect(transitionShape("fade", 1000).incomingDelaySec).toBe(
      MAX_FADE_SECONDS,
    );
  });
});

describe("windowRatios", () => {
  it("maps a window into 0..1 of the track", () => {
    expect(windowRatios(30, 10, 100)).toEqual({
      startRatio: 0.3,
      endRatio: 0.4,
    });
  });

  it("clamps a window that runs past the end", () => {
    expect(windowRatios(95, 10, 100)).toEqual({
      startRatio: 0.95,
      endRatio: 1,
    });
  });

  it("gives null for a track without a usable duration", () => {
    expect(windowRatios(10, 3, 0)).toBeNull();
    expect(windowRatios(10, 3, Number.NaN)).toBeNull();
  });
});
