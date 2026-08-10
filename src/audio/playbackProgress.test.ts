// Unit tests for the pure playback-progress rule.

import { describe, it, expect } from "vitest";
import { progressRatio } from "./playbackProgress";

describe("progressRatio", () => {
  it("is 0 at the start and 1 at the end", () => {
    expect(progressRatio(0, 100)).toBe(0);
    expect(progressRatio(100, 100)).toBe(1);
  });

  it("is the fraction played in between", () => {
    expect(progressRatio(25, 100)).toBe(0.25);
    expect(progressRatio(1.5, 3)).toBe(0.5);
  });

  it("clamps past the end to 1", () => {
    expect(progressRatio(120, 100)).toBe(1);
  });

  it("clamps a negative elapsed time to 0", () => {
    // A `fade` transition schedules its target to start later, so elapsed is
    // negative until it actually begins.
    expect(progressRatio(-2, 100)).toBe(0);
  });

  it("is 0 for a zero or invalid duration", () => {
    expect(progressRatio(5, 0)).toBe(0);
    expect(progressRatio(5, Number.NaN)).toBe(0);
    expect(progressRatio(5, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("is 0 for an invalid elapsed time", () => {
    expect(progressRatio(Number.NaN, 100)).toBe(0);
  });
});
