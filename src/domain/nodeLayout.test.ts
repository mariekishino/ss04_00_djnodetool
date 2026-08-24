// Unit tests for new-node placement.

import { describe, it, expect } from "vitest";
import type { TrackNode } from "./types";
import { freeNodePosition } from "./nodeLayout";

const WIDTH = 140;
const HEIGHT = 82;

function makeNode(id: string, x: number, y: number): TrackNode {
  return { id, trackId: `track-${id}`, x, y, label: "node" };
}

function overlaps(a: { x: number; y: number }, node: TrackNode): boolean {
  return (
    node.x < a.x + WIDTH &&
    a.x < node.x + WIDTH &&
    node.y < a.y + HEIGHT &&
    a.y < node.y + HEIGHT
  );
}

describe("freeNodePosition", () => {
  it("starts the cascade on an empty canvas", () => {
    expect(freeNodePosition([], WIDTH, HEIGHT)).toEqual({ x: 200, y: 200 });
  });

  it("skips a spot covered by an existing node", () => {
    const nodes = [makeNode("a", 200, 200)];
    const pos = freeNodePosition(nodes, WIDTH, HEIGHT);
    expect(overlaps(pos, nodes[0])).toBe(false);
  });

  it("walks past several consecutive occupied spots", () => {
    // Nodes sitting on the first four cascade spots.
    const nodes = [0, 1, 2, 3].map((i) =>
      makeNode(String(i), 200 + i * 30, 200 + i * 30),
    );
    const pos = freeNodePosition(nodes, WIDTH, HEIGHT);
    for (const node of nodes) {
      expect(overlaps(pos, node)).toBe(false);
    }
  });

  it("is not blocked by a node that only touches the spot's edge", () => {
    // Exactly one node-width to the right of the first spot.
    const nodes = [makeNode("a", 200 + WIDTH, 200)];
    expect(freeNodePosition(nodes, WIDTH, HEIGHT)).toEqual({ x: 200, y: 200 });
  });

  it("avoids a node from another session sitting off the cascade", () => {
    // The 2026-08-24 layout: mock nodes plus a saved node at (260, 260)
    // covering the mock node at (300, 280).
    const nodes = [
      makeNode("night-drive", 300, 280),
      makeNode("blue-memory", 360, 220),
      makeNode("midnight", 260, 260),
    ];
    const pos = freeNodePosition(nodes, WIDTH, HEIGHT);
    for (const node of nodes) {
      expect(overlaps(pos, node)).toBe(false);
    }
  });
});
