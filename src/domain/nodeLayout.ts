// Where a new node goes on the canvas.
//
// Phase 18: the old rule ("200 plus 30px per existing node, diagonally")
// ignored where existing nodes actually are, so a node added in one session
// could land exactly on top of a node from another and hide it completely
// (observed 2026-08-24: an edge appeared to leave the wrong node). The rule
// now walks the same diagonal cascade but keeps going until the spot is free.
//
// This is not auto-layout — just never landing on top of someone. The node
// size is passed in because it is a rendering constant the domain must not
// own (see src/components/canvasLayout.ts).

import type { TrackNode } from "./types";

const CASCADE_START = 200;
const CASCADE_STEP = 30;

/**
 * The first position on the diagonal cascade where a node of the given size
 * would not overlap any existing node. Touching edges is not an overlap.
 */
export function freeNodePosition(
  nodes: TrackNode[],
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  // The cascade leaves every finite set of nodes behind eventually, so this
  // loop always terminates.
  for (let step = 0; ; step++) {
    const x = CASCADE_START + step * CASCADE_STEP;
    const y = CASCADE_START + step * CASCADE_STEP;
    const taken = nodes.some(
      (node) =>
        node.x < x + nodeWidth &&
        x < node.x + nodeWidth &&
        node.y < y + nodeHeight &&
        y < node.y + nodeHeight,
    );
    if (!taken) return { x, y };
  }
}
