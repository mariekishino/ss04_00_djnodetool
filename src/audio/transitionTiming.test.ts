// Unit tests for the pure transition-timing helpers.

import { describe, it, expect } from "vitest";
import {
  sanitizeFadeDuration,
  transitionTriggerOffset,
  MIN_FADE_SECONDS,
  MAX_FADE_SECONDS,
} from "./transitionTiming";

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

describe("transitionTriggerOffset", () => {
  it("triggers a cut at the very end of the track", () => {
    expect(transitionTriggerOffset(30, "cut", 0)).toBe(30);
    // A cut ignores any fade value it is given.
    expect(transitionTriggerOffset(30, "cut", 5)).toBe(30);
  });

  it("triggers a fade and a crossfade one fade before the end", () => {
    expect(transitionTriggerOffset(30, "fade", 3)).toBe(27);
    expect(transitionTriggerOffset(30, "crossfade", 3)).toBe(27);
  });

  it("clamps to 0 when the fade is longer than the track", () => {
    expect(transitionTriggerOffset(2, "crossfade", 5)).toBe(0);
  });

  it("sanitizes the fade before subtracting it", () => {
    // A 0 fade becomes MIN_FADE_SECONDS, so the offset is just short of the end.
    expect(transitionTriggerOffset(10, "fade", 0)).toBe(10 - MIN_FADE_SECONDS);
  });

  it("treats an invalid duration as zero", () => {
    expect(transitionTriggerOffset(Number.NaN, "cut", 3)).toBe(0);
    expect(transitionTriggerOffset(-5, "crossfade", 3)).toBe(0);
  });
});
