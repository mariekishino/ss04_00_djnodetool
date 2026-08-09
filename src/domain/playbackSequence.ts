// Pure rules for walking the node graph during sequential playback.
//
// Phase 12: playback follows edges from node to node. Choosing which edge
// to follow is a domain rule, not an audio detail, so it lives here and is
// unit tested without any Web Audio involvement.

import type { TransitionEdge } from "./types";

/**
 * The edge sequential playback follows out of a node, or null when the
 * node has no outgoing edge (the sequence ends there).
 *
 * When a node has several outgoing edges, the first one in `edges` order
 * wins. Picking among branches (random, weighted, user choice) is a future
 * extension; a stable first-match keeps playback predictable for now.
 */
export function findNextEdge(
  edges: TransitionEdge[],
  fromNodeId: string,
): TransitionEdge | null {
  return edges.find((edge) => edge.fromNodeId === fromNodeId) ?? null;
}
