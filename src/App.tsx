// App is the top-level component. It owns the project data and the current
// selection state, and lays out the regions: the Track Library and Inspector
// Panel on the left, and the Node Canvas on the right.
//
// Phase 4: "Add to Canvas". The project is now held in useState (seeded with
// mockProject) so it can change at runtime. Clicking "Add to Canvas" on a
// track creates a new node, appends it to the project, and selects it.
//
// Phase 4.5: "Delete selected node". The Inspector's Delete button removes the
// selected node (and any edges connected to it) and clears the selection.
//
// Phase 5: "Drag nodes". A node can be dragged on the canvas; each move writes
// the node's new x/y back into the project. Connected edges follow because
// EdgeView derives its line geometry from the nodes' x/y.
//
// Phase 6: "JSON save/load". The project can be exported to a JSON file and
// imported back via the Project Toolbar. On a successful import the whole
// project is replaced and the selection is cleared.
//
// Phase 7: "Edge creation". Selecting a node and clicking "Start Connection"
// puts the canvas in connection mode; clicking a different node then creates a
// directed transition edge from the source to the target. Clicking empty space
// (or the source node) cancels. Audio and crossfade are not part of this phase.
//
// Phase 7.5: "Edge selection and delete". Clicking an edge selects it (and
// deselects any node); the Inspector then shows the connection's basic info and
// a "Delete connection" button that removes just that edge. Node and edge
// selection are mutually exclusive. Editing an edge is not part of this phase.
//
// Phase 8: "Simple audio playback". App owns one AudioEngine (lazily created)
// and passes it to PlayerControls, which can play or stop the selected node's
// sound. The engine is disposed when the app unmounts. Crossfade and real
// audio files are not part of this phase.
//
// Phase 10: "Edge editing". The Inspector can change a selected edge's
// transitionType and fadeDurationSec. The consistency rules (cut -> fade 0,
// fade/crossfade from 0 -> default) live in domain/edgeRules, not here.

import { useEffect, useRef, useState } from "react";
// The type and the component are both named TrackNode; alias the type to
// TrackNodeData here to avoid a naming collision with the component.
import type {
  Project,
  TransitionEdge,
  TransitionType,
  TrackNode as TrackNodeData,
} from "./domain/types";
import { mockProject } from "./domain/mockProject";
import {
  changeTransitionType,
  changeFadeDuration,
  DEFAULT_FADE_SECONDS,
} from "./domain/edgeRules";
import { downloadProject, parseProject } from "./storage/projectStorage";
import { AudioEngine } from "./audio/audioEngine";
import TrackLibrary from "./components/TrackLibrary";
import ProjectToolbar from "./components/ProjectToolbar";
import NodeCanvas from "./components/NodeCanvas";
import InspectorPanel from "./components/InspectorPanel";
import PlayerControls from "./components/PlayerControls";

// Default color for runtime-created nodes (tracks have no color of their own).
const DEFAULT_NODE_COLOR = "#64748B";

function App() {
  // The whole project lives in state so nodes can be added at runtime.
  const [project, setProject] = useState<Project>(mockProject);

  // One AudioEngine for the whole app. Lazily created: the ref starts null and
  // the engine is constructed on first access. Constructing it does not open an
  // AudioContext yet (that happens on the first playNode, a user gesture).
  //
  // The ref is only read inside event handlers (handlePlayNode / handleStop /
  // cleanup), never during render, so PlayerControls receives plain callbacks
  // and the UI never touches the engine directly.
  const audioEngineRef = useRef<AudioEngine | null>(null);
  function getAudioEngine(): AudioEngine {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
    }
    return audioEngineRef.current;
  }

  // Release audio resources when the app unmounts.
  useEffect(() => {
    return () => {
      audioEngineRef.current?.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  // The currently selected node, or null when nothing is selected.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // The currently selected edge, or null when nothing is selected. Node and
  // edge selection are mutually exclusive (see selectNode / selectEdge).
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // The source node id while the canvas is in connection mode, or null in
  // normal mode. Connection mode is entered via "Start Connection".
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(
    null,
  );

  // Select a node and clear any edge selection, keeping the two exclusive.
  function selectNode(nodeId: string | null) {
    setSelectedEdgeId(null);
    setSelectedNodeId(nodeId);
  }

  // Select an edge and clear any node selection, keeping the two exclusive.
  function selectEdge(edgeId: string | null) {
    setSelectedNodeId(null);
    setSelectedEdgeId(edgeId);
  }

  // Create a new node from a track and add it to the canvas, then select it.
  function handleAddToCanvas(trackId: string) {
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;

    // Simple fixed offset so repeated additions do not fully overlap.
    // A proper auto-layout is intentionally out of scope for this phase.
    const offset = project.nodes.length * 30;
    const newNode: TrackNodeData = {
      id: crypto.randomUUID(),
      trackId: track.id,
      x: 200 + offset,
      y: 200 + offset,
      label: track.title,
      color: DEFAULT_NODE_COLOR,
    };

    setProject((current) => ({
      ...current,
      nodes: [...current.nodes, newNode],
    }));
    selectNode(newNode.id);
  }

  // Move a node to a new position by writing its x/y back into the project.
  // Called repeatedly while dragging, so it only replaces the one node.
  function handleMoveNode(nodeId: string, x: number, y: number) {
    setProject((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, x, y } : node,
      ),
    }));
  }

  // Delete a node and any edges connected to it, then clear the selection.
  function handleDeleteNode(nodeId: string) {
    setProject((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      // Remove edges touching the deleted node so no edge dangles.
      edges: current.edges.filter(
        (edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId,
      ),
    }));
    // The node and any of its edges are gone; clear both selections so neither
    // points at something that no longer exists.
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  // Replace one edge in the project with an updated copy produced by `update`.
  function updateEdge(
    edgeId: string,
    update: (edge: TransitionEdge) => TransitionEdge,
  ) {
    setProject((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.id === edgeId ? update(edge) : edge,
      ),
    }));
  }

  // Change an edge's transition type. edgeRules keeps fadeDurationSec
  // consistent (cut -> 0, fade/crossfade from 0 -> default).
  function handleChangeEdgeTransitionType(
    edgeId: string,
    transitionType: TransitionType,
  ) {
    updateEdge(edgeId, (edge) => changeTransitionType(edge, transitionType));
  }

  // Change an edge's fade duration. edgeRules clamps invalid input to 0.
  function handleChangeEdgeFadeDuration(edgeId: string, seconds: number) {
    updateEdge(edgeId, (edge) => changeFadeDuration(edge, seconds));
  }

  // Delete a single edge by id, then clear the edge selection.
  function handleDeleteEdge(edgeId: string) {
    setProject((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== edgeId),
    }));
    setSelectedEdgeId(null);
  }

  // Export the current project as a downloadable JSON file.
  function handleExport() {
    downloadProject(project);
  }

  // Import a project from a JSON file, replacing the current one. On any parse
  // or validation error, keep the current project and show a simple message.
  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loaded = parseProject(String(reader.result));
        setProject(loaded);
        // The loaded project has its own ids, so clear every piece of selection
        // state that could still point at the old project.
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectionSourceId(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load file.";
        window.alert(`Import failed: ${message}`);
      }
    };
    reader.onerror = () => {
      window.alert("Import failed: could not read the file.");
    };
    reader.readAsText(file);
  }

  // Enter connection mode using the currently selected node as the source.
  function handleStartConnection() {
    if (selectedNodeId) {
      setConnectionSourceId(selectedNodeId);
    }
  }

  // Handle a click on a node. In connection mode, clicking a different node
  // creates the edge and returns to normal mode (the source stays selected);
  // clicking the source node cancels. In normal mode, it selects the node.
  function handleNodeClick(nodeId: string) {
    if (connectionSourceId) {
      if (nodeId !== connectionSourceId) {
        const newEdge: TransitionEdge = {
          id: crypto.randomUUID(),
          fromNodeId: connectionSourceId,
          toNodeId: nodeId,
          transitionType: "crossfade",
          fadeDurationSec: DEFAULT_FADE_SECONDS,
        };
        setProject((current) => ({
          ...current,
          edges: [...current.edges, newEdge],
        }));
      }
      // Leave connection mode; keep the source node selected.
      setConnectionSourceId(null);
      return;
    }
    selectNode(nodeId);
  }

  // Handle a click on an edge. Ignored while connecting (so the connection flow
  // is not disturbed); otherwise it selects the edge.
  function handleEdgeClick(edgeId: string) {
    if (connectionSourceId) return;
    selectEdge(edgeId);
  }

  // Handle a click on the empty canvas background. In connection mode it
  // cancels the connection; otherwise it clears both selections.
  function handleBackgroundClick() {
    if (connectionSourceId) {
      setConnectionSourceId(null);
      return;
    }
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  // The currently selected node object (or null), used by PlayerControls.
  const selectedNode =
    project.nodes.find((node) => node.id === selectedNodeId) ?? null;

  // The currently selected edge and its source/target nodes (or null), used by
  // PlayerControls to play a transition preview.
  const selectedEdge =
    project.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const transitionSourceNode = selectedEdge
    ? (project.nodes.find((node) => node.id === selectedEdge.fromNodeId) ?? null)
    : null;
  const transitionTargetNode = selectedEdge
    ? (project.nodes.find((node) => node.id === selectedEdge.toNodeId) ?? null)
    : null;

  // Play a node's sound via the (lazily created) audio engine. Called from a
  // user gesture, so this is where the AudioContext first comes to life.
  function handlePlayNode(node: TrackNodeData) {
    getAudioEngine().playNode(node);
  }

  // Play an edge's transition between its source and target nodes.
  function handlePlayTransition(
    edge: TransitionEdge,
    sourceNode: TrackNodeData,
    targetNode: TrackNodeData,
  ) {
    getAudioEngine().playTransition(edge, sourceNode, targetNode);
  }

  // Stop any current playback.
  function handleStop() {
    getAudioEngine().stop();
  }

  return (
    <div className="app-layout">
      <div className="left-column">
        <ProjectToolbar
          onExport={handleExport}
          onImportFile={handleImportFile}
        />
        <TrackLibrary
          tracks={project.tracks}
          onAddToCanvas={handleAddToCanvas}
        />
        <InspectorPanel
          tracks={project.tracks}
          nodes={project.nodes}
          edges={project.edges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          isConnecting={connectionSourceId !== null}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onStartConnection={handleStartConnection}
          onChangeEdgeTransitionType={handleChangeEdgeTransitionType}
          onChangeEdgeFadeDuration={handleChangeEdgeFadeDuration}
        />
        <PlayerControls
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          sourceNode={transitionSourceNode}
          targetNode={transitionTargetNode}
          onPlayNode={handlePlayNode}
          onPlayTransition={handlePlayTransition}
          onStop={handleStop}
        />
      </div>
      <NodeCanvas
        tracks={project.tracks}
        nodes={project.nodes}
        edges={project.edges}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        connectionSourceId={connectionSourceId}
        onSelectNode={selectNode}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onBackgroundClick={handleBackgroundClick}
        onMoveNode={handleMoveNode}
      />
    </div>
  );
}

export default App;
