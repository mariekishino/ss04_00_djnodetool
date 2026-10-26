// Unit tests for the pure edge-editing rules.

import { describe, it, expect } from "vitest";
import type { TransitionEdge } from "./types";
import {
  changeTransitionType,
  changeFadeDuration,
  changeExitPosition,
  changeEnterPosition,
  DEFAULT_FADE_SECONDS,
} from "./edgeRules";

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

describe("changeTransitionType", () => {
  it("zeroes the fade duration when switching to cut", () => {
    const edge = makeEdge({ transitionType: "crossfade", fadeDurationSec: 5 });
    const result = changeTransitionType(edge, "cut");
    expect(result.transitionType).toBe("cut");
    expect(result.fadeDurationSec).toBe(0);
  });

  it("keeps a positive fade when switching between fade and crossfade", () => {
    const edge = makeEdge({ transitionType: "crossfade", fadeDurationSec: 5 });
    const result = changeTransitionType(edge, "fade");
    expect(result.transitionType).toBe("fade");
    expect(result.fadeDurationSec).toBe(5);
  });

  it("resets a 0 fade to the default when switching away from cut", () => {
    const edge = makeEdge({ transitionType: "cut", fadeDurationSec: 0 });
    const result = changeTransitionType(edge, "crossfade");
    expect(result.transitionType).toBe("crossfade");
    expect(result.fadeDurationSec).toBe(DEFAULT_FADE_SECONDS);
  });

  it("does not mutate the original edge", () => {
    const edge = makeEdge({ transitionType: "crossfade", fadeDurationSec: 5 });
    changeTransitionType(edge, "cut");
    expect(edge.transitionType).toBe("crossfade");
    expect(edge.fadeDurationSec).toBe(5);
  });
});

describe("changeFadeDuration", () => {
  it("sets a positive fade duration", () => {
    const edge = makeEdge({ fadeDurationSec: 3 });
    expect(changeFadeDuration(edge, 7.5).fadeDurationSec).toBe(7.5);
  });

  it("clamps negative values to 0", () => {
    const edge = makeEdge();
    expect(changeFadeDuration(edge, -2).fadeDurationSec).toBe(0);
  });

  it("clamps NaN (e.g. an emptied number input) to 0", () => {
    const edge = makeEdge();
    expect(changeFadeDuration(edge, Number.NaN).fadeDurationSec).toBe(0);
  });

  it("keeps a cut edge at 0 regardless of input", () => {
    const edge = makeEdge({ transitionType: "cut", fadeDurationSec: 0 });
    expect(changeFadeDuration(edge, 4).fadeDurationSec).toBe(0);
  });
});

describe("changeExitPosition / changeEnterPosition", () => {
  it("sets a position inside the track", () => {
    expect(changeExitPosition(makeEdge(), 42, 180).exitAtSec).toBe(42);
    expect(changeEnterPosition(makeEdge(), 12.5, 180).enterAtSec).toBe(12.5);
  });

  it("clamps below 0 and above the track's duration", () => {
    expect(changeExitPosition(makeEdge(), -5, 180).exitAtSec).toBe(0);
    expect(changeExitPosition(makeEdge(), 500, 180).exitAtSec).toBe(180);
    expect(changeEnterPosition(makeEdge(), 500, 180).enterAtSec).toBe(180);
  });

  it("clears the position on non-finite input, dropping the key", () => {
    const edge = makeEdge({ exitAtSec: 30, enterAtSec: 10 });
    const exitCleared = changeExitPosition(edge, Number.NaN, 180);
    expect(exitCleared.exitAtSec).toBeUndefined();
    expect("exitAtSec" in exitCleared).toBe(false);
    // The other position is untouched.
    expect(exitCleared.enterAtSec).toBe(10);

    const enterCleared = changeEnterPosition(edge, Number.NaN, 180);
    expect("enterAtSec" in enterCleared).toBe(false);
    expect(enterCleared.exitAtSec).toBe(30);
  });

  it("rounds a position to 10 ms", () => {
    expect(changeExitPosition(makeEdge(), 128.77451, 180).exitAtSec).toBe(
      128.77,
    );
    expect(changeEnterPosition(makeEdge(), 60.875, 180).enterAtSec).toBe(60.88);
  });

  it("treats an unknown duration as 0, so a position cannot escape it", () => {
    expect(changeExitPosition(makeEdge(), 10, Number.NaN).exitAtSec).toBe(0);
    expect(changeEnterPosition(makeEdge(), 10, 0).enterAtSec).toBe(0);
  });

  it("does not mutate the original edge", () => {
    const edge = makeEdge();
    changeExitPosition(edge, 42, 180);
    expect(edge.exitAtSec).toBeUndefined();
    expect(edge.id).toBe("edge-1");
  });
});
