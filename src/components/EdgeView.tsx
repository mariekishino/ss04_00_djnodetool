// EdgeView renders a single transition edge as an SVG line with an
// arrowhead, drawn from the center of the source node to the center of
// the target node.
//
// Phase 2: static display only. It receives the resolved from/to nodes
// and computes their centers using the fixed node size.
//
// Phase 7.5: an edge can be selected. A wide, transparent "hit line" is drawn
// on top of the thin visible line so the edge is easy to click; clicking it
// calls onSelect. The visible line gets a selected style when isSelected is
// true. Click selection logic itself lives in the parent (NodeCanvas/App).

import type { TrackNode } from "../domain/types";
import { NODE_WIDTH, NODE_HEIGHT } from "./canvasLayout";

type EdgeViewProps = {
  fromNode: TrackNode;
  toNode: TrackNode;
  // Shared SVG marker id for the arrowhead, defined once by NodeCanvas.
  markerId: string;
  isSelected: boolean;
  // True while a running sequence is handing over across this edge, for the
  // few seconds its fade lasts.
  isTransitioning: boolean;
  onSelect: () => void;
};

function nodeCenter(node: TrackNode) {
  return {
    x: node.x + NODE_WIDTH / 2,
    y: node.y + NODE_HEIGHT / 2,
  };
}

function EdgeView({
  fromNode,
  toNode,
  markerId,
  isSelected,
  isTransitioning,
  onSelect,
}: EdgeViewProps) {
  const from = nodeCenter(fromNode);
  const to = nodeCenter(toNode);

  const lineClassName = [
    "edge-line",
    isSelected ? "selected" : "",
    isTransitioning ? "transitioning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <g>
      {/* Wide, invisible line that catches clicks so the thin edge is easy to
          hit. It must stop propagation so the click does not reach the canvas
          background (which would clear the selection). */}
      <line
        className="edge-hit"
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      />
      {/* The visible edge. pointer-events are disabled so only the hit line
          handles clicks. */}
      <line
        className={lineClassName}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        markerEnd={`url(#${markerId})`}
      />
    </g>
  );
}

export default EdgeView;
