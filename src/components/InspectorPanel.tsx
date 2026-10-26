// InspectorPanel shows read-only details of the currently selected node.
//
// Phase 3: node selection only. It finds the selected node by id and
// displays its label, linked track title/artist, position, and color.
// When nothing is selected it shows a placeholder.
//
// Phase 4.5: a Delete button is shown only when a node is selected. Clicking
// it asks the parent (App) to delete that node via onDeleteNode. The fields
// themselves stay read-only; edge inspection and editing are still out of scope.
//
// Phase 7: a "Start Connection" button begins edge creation from the selected
// node. While connection mode is active it shows a short hint instead.
//
// Phase 7.5: when an edge is selected instead of a node, the panel shows the
// connection's basic info (from -> to, transition type, fade duration) read
// only, plus a "Delete connection" button.
//
// Phase 10: the edge view becomes editable: a select for transitionType and a
// number input for fadeDurationSec. The panel only reports the user's choice
// via callbacks; the consistency rules (cut -> fade 0, etc.) are applied by
// App using domain/edgeRules. The fade input is disabled for "cut" because a
// cut is instant and its fade is always 0. Editing `note` is still out of
// scope.
//
// Phase 20: two more number inputs on the edge view, "Exit at" (where the
// transition leaves the from-track) and "Enter at" (where it comes into the
// to-track). An empty field means the default, and clearing a field is how
// the user goes back to it; the rules live in domain/edgeRules.

import type {
  Track,
  TrackNode,
  TransitionEdge,
  TransitionType,
} from "../domain/types";

// Options for the transition type select, in display order.
const TRANSITION_TYPES: TransitionType[] = ["cut", "fade", "crossfade"];

type InspectorPanelProps = {
  tracks: Track[];
  nodes: TrackNode[];
  edges: TransitionEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isConnecting: boolean;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onStartConnection: () => void;
  onChangeEdgeTransitionType: (
    edgeId: string,
    transitionType: TransitionType,
  ) => void;
  onChangeEdgeFadeDuration: (edgeId: string, seconds: number) => void;
  onChangeEdgeExitPosition: (edgeId: string, seconds: number) => void;
  onChangeEdgeEnterPosition: (edgeId: string, seconds: number) => void;
};

function InspectorPanel({
  tracks,
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  isConnecting,
  onDeleteNode,
  onDeleteEdge,
  onStartConnection,
  onChangeEdgeTransitionType,
  onChangeEdgeFadeDuration,
  onChangeEdgeExitPosition,
  onChangeEdgeEnterPosition,
}: InspectorPanelProps) {
  // Edge selection takes priority when present (selection is exclusive, so at
  // most one of node/edge is set at a time).
  const edge = edges.find((e) => e.id === selectedEdgeId);
  if (edge) {
    const fromNode = nodes.find((n) => n.id === edge.fromNodeId);
    const toNode = nodes.find((n) => n.id === edge.toNodeId);
    const fromLabel = fromNode ? fromNode.label : edge.fromNodeId;
    const toLabel = toNode ? toNode.label : edge.toNodeId;

    return (
      <section className="inspector-panel">
        <h2>Inspector</h2>
        <dl className="inspector-fields">
          <dt>Connection</dt>
          <dd>
            {fromLabel} → {toLabel}
          </dd>

          <dt>
            <label htmlFor="edge-transition-type">Transition</label>
          </dt>
          <dd>
            <select
              id="edge-transition-type"
              className="inspector-select"
              value={edge.transitionType}
              onChange={(event) =>
                // The options come from TRANSITION_TYPES, so the value is
                // always a valid TransitionType; the cast just tells TS.
                onChangeEdgeTransitionType(
                  edge.id,
                  event.target.value as TransitionType,
                )
              }
            >
              {TRANSITION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </dd>

          <dt>
            <label htmlFor="edge-fade-duration">Fade</label>
          </dt>
          <dd>
            <input
              id="edge-fade-duration"
              className="inspector-number-input"
              type="number"
              min={0}
              step={0.5}
              value={edge.fadeDurationSec}
              disabled={edge.transitionType === "cut"}
              onChange={(event) =>
                // valueAsNumber is NaN while the field is emptied; edgeRules
                // clamps that to 0.
                onChangeEdgeFadeDuration(edge.id, event.target.valueAsNumber)
              }
            />
            <span className="inspector-unit">s</span>
          </dd>

          <dt>
            <label htmlFor="edge-exit-at">Exit at</label>
          </dt>
          <dd>
            <input
              id="edge-exit-at"
              className="inspector-number-input"
              type="number"
              min={0}
              step={0.1}
              value={edge.exitAtSec ?? ""}
              placeholder={edge.transitionType === "cut" ? "end" : "end − fade"}
              onChange={(event) =>
                // NaN from an emptied field clears the position (edgeRules).
                onChangeEdgeExitPosition(edge.id, event.target.valueAsNumber)
              }
            />
            <span className="inspector-unit">s</span>
          </dd>

          <dt>
            <label htmlFor="edge-enter-at">Enter at</label>
          </dt>
          <dd>
            <input
              id="edge-enter-at"
              className="inspector-number-input"
              type="number"
              min={0}
              step={0.1}
              value={edge.enterAtSec ?? ""}
              placeholder="start"
              onChange={(event) =>
                onChangeEdgeEnterPosition(edge.id, event.target.valueAsNumber)
              }
            />
            <span className="inspector-unit">s</span>
          </dd>
        </dl>

        <p className="inspector-note">
          Exit is where {fromLabel} leaves; Enter is where {toLabel} comes in.
          Clear a field to use the default. Clicking the NOW or NEXT waveform
          sets them too.
        </p>

        <button
          type="button"
          className="delete-edge-button"
          onClick={() => onDeleteEdge(edge.id)}
        >
          Delete connection
        </button>
      </section>
    );
  }

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <section className="inspector-panel">
        <h2>Inspector</h2>
        <p className="inspector-placeholder">Select a node or connection</p>
      </section>
    );
  }

  const track = tracks.find((t) => t.id === node.trackId);

  return (
    <section className="inspector-panel">
      <h2>Inspector</h2>
      <dl className="inspector-fields">
        <dt>Label</dt>
        <dd>{node.label}</dd>

        <dt>Track</dt>
        <dd>{track ? track.title : node.trackId}</dd>

        <dt>Artist</dt>
        <dd>{track?.artist ?? "—"}</dd>

        <dt>Position</dt>
        <dd>
          x: {node.x}, y: {node.y}
        </dd>

        <dt>Color</dt>
        <dd>
          {node.color ? (
            <span className="inspector-color">
              <span
                className="inspector-color-swatch"
                style={{ background: node.color }}
              />
              {node.color}
            </span>
          ) : (
            "—"
          )}
        </dd>
      </dl>

      {isConnecting ? (
        <p className="inspector-hint">
          Connection mode: click a target node, or click empty space to cancel.
        </p>
      ) : (
        <button
          type="button"
          className="start-connection-button"
          onClick={onStartConnection}
        >
          Start Connection
        </button>
      )}

      <button
        type="button"
        className="delete-node-button"
        onClick={() => onDeleteNode(node.id)}
      >
        Delete node
      </button>
    </section>
  );
}

export default InspectorPanel;
