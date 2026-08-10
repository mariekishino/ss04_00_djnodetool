// Unit tests for the sequential-playback graph rules.

import { describe, it, expect } from "vitest";
import type { TransitionEdge } from "./types";
import { findNextEdge } from "./playbackSequence";

function makeEdge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
): TransitionEdge {
  return {
    id,
    fromNodeId,
    toNodeId,
    transitionType: "crossfade",
    fadeDurationSec: 3,
  };
}

describe("findNextEdge", () => {
  it("returns null when the node has no outgoing edge", () => {
    const edges = [makeEdge("e1", "a", "b")];
    expect(findNextEdge(edges, "b")).toBeNull();
  });

  it("returns null for an empty graph", () => {
    expect(findNextEdge([], "a")).toBeNull();
  });

  it("returns the single outgoing edge", () => {
    const edge = makeEdge("e1", "a", "b");
    expect(findNextEdge([edge], "a")).toBe(edge);
  });

  it("returns the first outgoing edge when the node branches", () => {
    const first = makeEdge("e1", "a", "b");
    const second = makeEdge("e2", "a", "c");
    expect(findNextEdge([first, second], "a")).toBe(first);
  });

  it("ignores edges that only point into the node", () => {
    const incoming = makeEdge("e1", "z", "a");
    const outgoing = makeEdge("e2", "a", "b");
    expect(findNextEdge([incoming, outgoing], "a")).toBe(outgoing);
  });
});
