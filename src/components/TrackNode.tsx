// TrackNode renders a single node as a card on the canvas.
//
// Phase 3: node selection. The card is absolutely positioned using the
// node's x/y (CSS pixels from the canvas top-left) and a fixed size. It
// shows the node label and the linked track's artist (if available).
//
// Phase 5: node dragging. mousedown selects the node and starts a drag;
// while dragging, window mousemove updates the node's x/y (converted into
// canvas-relative coordinates via the canvas ref); mouseup ends the drag.
// A click that actually moved is suppressed so a drag does not also re-run
// the selection click. EdgeView follows automatically from the new x/y.
//
// Phase 7: edge creation. In connection mode (isConnecting) dragging is fully
// suppressed so a node click can complete the connection. The click is routed
// through onClickNode, which the parent interprets as "select" in normal mode
// or "complete connection" in connection mode.

import { useRef } from "react";
import type { RefObject } from "react";
import type { Track, TrackNode as TrackNodeType } from "../domain/types";
import { NODE_WIDTH, NODE_HEIGHT } from "./canvasLayout";

type TrackNodeProps = {
  node: TrackNodeType;
  track?: Track;
  isSelected: boolean;
  // True for the node a running sequence is currently playing.
  isPlaying: boolean;
  // True for the source node while connection mode is active.
  isConnectionSource: boolean;
  // True whenever the canvas is in connection mode (any source chosen).
  isConnecting: boolean;
  // The canvas element, owned by NodeCanvas, used to map mouse coordinates
  // into canvas space. TrackNode never queries the DOM for it directly.
  canvasRef: RefObject<HTMLElement | null>;
  onSelect: () => void;
  onClickNode: () => void;
  onMove: (x: number, y: number) => void;
};

function TrackNode({
  node,
  track,
  isSelected,
  isPlaying,
  isConnectionSource,
  isConnecting,
  canvasRef,
  onSelect,
  onClickNode,
  onMove,
}: TrackNodeProps) {
  // True once the pointer has actually moved during a drag. Used to suppress
  // the click that the browser fires after mouseup, so dragging does not also
  // count as a plain select click.
  const didDragRef = useRef(false);

  function handleMouseDown(event: React.MouseEvent) {
    // Only react to the primary (left) button.
    if (event.button !== 0) return;
    // Don't let this reach the canvas background (which would deselect or
    // cancel a connection).
    event.stopPropagation();
    // In connection mode, dragging is disabled so the upcoming click can
    // complete the connection. Do nothing else here.
    if (isConnecting) return;
    // Select immediately, so starting a drag also selects the node.
    onSelect();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    // Offset between the pointer and the node's top-left corner, so the node
    // does not jump to center itself under the cursor when the drag starts.
    const offsetX = event.clientX - (canvasRect.left + node.x);
    const offsetY = event.clientY - (canvasRect.top + node.y);

    didDragRef.current = false;

    function handleMouseMove(moveEvent: MouseEvent) {
      didDragRef.current = true;
      const x = moveEvent.clientX - canvasRect.left - offsetX;
      const y = moveEvent.clientY - canvasRect.top - offsetY;
      onMove(x, y);
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  const className = [
    "track-node",
    isSelected ? "selected" : "",
    isPlaying ? "playing" : "",
    isConnectionSource ? "connection-source" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        borderColor: node.color,
      }}
      onMouseDown={handleMouseDown}
      onClick={(event) => {
        // Stop the click from reaching the canvas background, which would
        // otherwise deselect this node or cancel a pending connection.
        event.stopPropagation();
        // If this click is the tail end of a drag, ignore it: selection
        // already happened on mousedown, and we don't want drag == click.
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
        // Let the parent decide: select (normal mode) or complete the
        // connection (connection mode).
        onClickNode();
      }}
    >
      <span className="track-node-label">{node.label}</span>
      {track?.artist && (
        <span className="track-node-artist">{track.artist}</span>
      )}
    </div>
  );
}

export default TrackNode;
