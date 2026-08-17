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
//
// Phase 17: "Seek by clicking". A click on a deck's waveform moves playback
// to that point. Web Audio cannot move a playing source, so the engine starts
// a new one at an offset; a running sequence reschedules its hand-over from
// what is left of the track.
//
// Phase 16: "Deck panel and waveform". A strip along the bottom shows the
// track playing now and the one playback would move to next, each with its
// waveform (peaks cached per track and width) and an editable BPM. App
// resolves which nodes the two decks show; the moving playhead is polled by
// the deck itself, like the node's progress bar.
//
// Phase 14: "Local server persistence". At startup App asks the local server
// for the saved project and the files in its audio folder; if the server is
// not running it falls back to mockProject and the session-only file picker,
// with saving disabled. A track's audio now lives at a URL (Track.audioUrl),
// so it can be fetched again after a reload.
//
// Phase 13: "Playback progress". The playing node shows a progress bar and
// elapsed / total time, and the edge being crossed lights up during the fade.
// App holds the (rarely changing) transitioning edge id in state and hands the
// canvas a getter for the moving position, which NodeProgress polls on its own
// animation frame so App is not re-rendered per frame.
//
// Phase 12: "Sequential playback". "Play from here" starts a SequencePlayer
// that walks the graph from the selected node, handing over to the next track
// at each edge. App keeps nowPlayingNodeId in state (fed by the player's
// callback) so the canvas can highlight the node being played, and Stop stops
// the sequence as well as the audio.
//
// Phase 11: "Audio file import". App owns the TrackAudioStore (decoded audio
// per track, in-memory only) and passes it to the AudioEngine. "Load audio"
// in the Track Library decodes a picked file via the engine; trackAudioInfo
// mirrors what is loaded (file name + duration) as React state for display.
// Nothing audio-related is saved to the project JSON in this phase.

import { useEffect, useRef, useState } from "react";
// The type and the component are both named TrackNode; alias the type to
// TrackNodeData here to avoid a naming collision with the component.
import type {
  Project,
  Track,
  TransitionEdge,
  TransitionType,
  TrackNode as TrackNodeData,
} from "./domain/types";
import { trackTitleFromFileName } from "./domain/trackRules";
import { findNextEdge } from "./domain/playbackSequence";
import { mockProject } from "./domain/mockProject";
import {
  changeTransitionType,
  changeFadeDuration,
  DEFAULT_FADE_SECONDS,
} from "./domain/edgeRules";
import { downloadProject, parseProject } from "./storage/projectStorage";
import {
  fetchServerTracks,
  fetchServerProject,
  saveServerProject,
  audioFileNameFromUrl,
  type ServerTrackFile,
} from "./storage/serverStorage";
import { AudioEngine } from "./audio/audioEngine";
import { TrackAudioStore } from "./audio/trackAudioStore";
import { SequencePlayer } from "./audio/sequencePlayer";
import { WaveformCache } from "./audio/waveformCache";
import { offsetFromRatio } from "./audio/playbackProgress";
import TrackLibrary, { type TrackAudioInfo } from "./components/TrackLibrary";
import ProjectToolbar from "./components/ProjectToolbar";
import NodeCanvas from "./components/NodeCanvas";
import InspectorPanel from "./components/InspectorPanel";
import PlayerControls from "./components/PlayerControls";
import DeckPanel from "./components/DeckPanel";

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

  // Decoded audio per track, shared between the engine (playback) and the
  // future Analyzer. Lives in a ref because it is not render state; the
  // displayable part is mirrored in trackAudioInfo below.
  const trackAudioStoreRef = useRef<TrackAudioStore | null>(null);
  function getTrackAudioStore(): TrackAudioStore {
    if (!trackAudioStoreRef.current) {
      trackAudioStoreRef.current = new TrackAudioStore();
    }
    return trackAudioStoreRef.current;
  }

  function getAudioEngine(): AudioEngine {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine(getTrackAudioStore());
    }
    return audioEngineRef.current;
  }

  // What audio is loaded per track (file name + duration), for the Track
  // Library display. Rebuilt each session; the durable part is Track.audioUrl.
  const [trackAudioInfo, setTrackAudioInfo] = useState<
    Map<string, TrackAudioInfo>
  >(new Map());

  // The files in the server's audio folder, or null while unknown / when the
  // server is not running. Null also drives the offline fallbacks in the UI.
  const [serverFiles, setServerFiles] = useState<ServerTrackFile[] | null>(
    null,
  );

  // The result of the last save attempt, shown in the toolbar. Null before any
  // save this session.
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Record that a track's audio is loaded, for the Track Library display.
  function rememberTrackAudio(
    trackId: string,
    fileName: string,
    durationSec: number,
  ) {
    setTrackAudioInfo((current) =>
      new Map(current).set(trackId, { fileName, durationSec }),
    );
  }

  // The node currently playing, whether from a single Play or as a step of a
  // sequence, or null when nothing is playing. The SequencePlayer's callback
  // writes it during a sequence; handlePlayNode writes it for a single node.
  const [nowPlayingNodeId, setNowPlayingNodeId] = useState<string | null>(null);

  // The edge a running sequence is crossing, while its fade lasts. It changes
  // only twice per handover, so plain state is enough (the moving progress
  // bar is animated separately, inside NodeProgress).
  const [transitioningEdgeId, setTransitioningEdgeId] = useState<string | null>(
    null,
  );

  // The sequential player, created on first use like the engine. It reports
  // each step back through these listeners so the UI can follow along.
  const sequencePlayerRef = useRef<SequencePlayer | null>(null);
  function getSequencePlayer(): SequencePlayer {
    if (!sequencePlayerRef.current) {
      sequencePlayerRef.current = new SequencePlayer(getAudioEngine(), {
        onNowPlaying: setNowPlayingNodeId,
        onTransitionEdge: setTransitioningEdgeId,
      });
    }
    return sequencePlayerRef.current;
  }

  // Where playback currently is, read repeatedly by the playing node's
  // progress display. A getter, so App does not re-render for each frame.
  function getPlaybackProgress() {
    return audioEngineRef.current?.playbackProgress() ?? null;
  }

  // Waveform peaks per track, computed on first request and cached. Created
  // lazily like the engine, over the same decoded audio.
  const waveformCacheRef = useRef<WaveformCache | null>(null);
  function getTrackPeaks(trackId: string, bucketCount: number) {
    if (!waveformCacheRef.current) {
      waveformCacheRef.current = new WaveformCache(getTrackAudioStore());
    }
    return waveformCacheRef.current.peaksFor(trackId, bucketCount);
  }

  // Ask the local server, once, for its audio files and saved project. When it
  // is not running everything below is skipped and the app keeps the mock
  // project with serverFiles null, which is the offline mode.
  useEffect(() => {
    let cancelled = false;

    async function loadFromServer() {
      const [files, saved] = await Promise.all([
        fetchServerTracks(),
        fetchServerProject(),
      ]);
      if (cancelled || !files.available) return;

      setServerFiles(files.value ?? []);
      if (!saved.value) return;

      setProject(saved.value);
      // Fetch and decode the audio each saved track points at. One missing
      // file must not stop the others, so failures are ignored per track.
      for (const track of saved.value.tracks) {
        if (cancelled) return;
        if (!track.audioUrl) continue;
        try {
          const { durationSec } = await getAudioEngine().loadTrackAudioFromUrl(
            track.id,
            track.audioUrl,
          );
          if (cancelled) return;
          rememberTrackAudio(
            track.id,
            audioFileNameFromUrl(track.audioUrl),
            durationSec,
          );
        } catch {
          // Left without audio; the track still appears in the library.
        }
      }
    }

    void loadFromServer();
    return () => {
      cancelled = true;
    };
    // Runs once on mount; the helpers it uses are stable for the app's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Release audio resources when the app unmounts. The sequence is stopped
  // first so no pending timer fires against a disposed engine.
  useEffect(() => {
    return () => {
      sequencePlayerRef.current?.stop();
      sequencePlayerRef.current = null;
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

  // Import an audio file for a track: decode it via the engine (which stores
  // the result in the TrackAudioStore) and record file name + duration for
  // display. On a failed decode the store is unchanged and a simple message
  // is shown, same pattern as JSON import.
  //
  // This is the offline path (no server): the audio lasts for the session
  // only, because a picked file has no URL the project could remember.
  async function handleImportTrackAudio(trackId: string, file: File) {
    try {
      const { durationSec } = await getAudioEngine().importTrackAudio(
        trackId,
        file,
      );
      rememberTrackAudio(trackId, file.name, durationSec);
    } catch {
      window.alert(
        `Could not load "${file.name}". It may not be a supported audio file.`,
      );
    }
  }

  // Add a new track from one of the server's audio files, and load its audio
  // so it can be played immediately. The file name (without its extension)
  // becomes the title; artist and BPM are left empty because a file name does
  // not know them.
  async function handleAddTrackFromAudio(file: ServerTrackFile) {
    const newTrack: Track = {
      id: crypto.randomUUID(),
      title: trackTitleFromFileName(file.fileName),
      tags: [],
      audioUrl: file.url,
    };
    setProject((current) => ({
      ...current,
      tracks: [...current.tracks, newTrack],
    }));

    try {
      const { durationSec } = await getAudioEngine().loadTrackAudioFromUrl(
        newTrack.id,
        file.url,
      );
      rememberTrackAudio(newTrack.id, file.fileName, durationSec);
    } catch {
      // The track is added either way; it simply has no audio loaded.
      window.alert(`Could not load "${file.fileName}" from the server.`);
    }
  }

  // Remove a track from the library. Only reachable when no node uses it (the
  // button is disabled otherwise), so no node is left pointing at nothing.
  function handleRemoveTrack(trackId: string) {
    setProject((current) => ({
      ...current,
      tracks: current.tracks.filter((track) => track.id !== trackId),
    }));
    setTrackAudioInfo((current) => {
      const next = new Map(current);
      next.delete(trackId);
      return next;
    });
  }

  // Attach one of the server's audio files to a track. The URL is written into
  // the project, so saving and reloading brings the audio back.
  async function handleChooseServerFile(
    trackId: string,
    file: ServerTrackFile,
  ) {
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) =>
        track.id === trackId ? { ...track, audioUrl: file.url } : track,
      ),
    }));

    try {
      const { durationSec } = await getAudioEngine().loadTrackAudioFromUrl(
        trackId,
        file.url,
      );
      rememberTrackAudio(trackId, file.fileName, durationSec);
    } catch {
      window.alert(`Could not load "${file.fileName}" from the server.`);
    }
  }

  // Save the project on the local server. The status line reports the result
  // rather than interrupting with a dialog on the common (successful) path.
  async function handleSave() {
    setSaveStatus("Saving…");
    const result = await saveServerProject(project);
    if (result.value) {
      setSaveStatus("Saved");
    } else {
      setSaveStatus(
        result.available ? "Save failed" : "Server not running",
      );
    }
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

  // Tracks that a node uses, so the library can block removing them. Derived
  // from the nodes rather than stored, so it cannot fall out of step.
  const usedTrackIds = new Set(project.nodes.map((node) => node.trackId));

  // What the deck panel shows: the node playing now, or the selected one when
  // nothing plays, and the node playback would move to from there. The NEXT
  // deck follows the same first-outgoing-edge rule as sequential playback, so
  // it shows what would actually come next.
  const deckNowNode =
    project.nodes.find((node) => node.id === nowPlayingNodeId) ??
    project.nodes.find((node) => node.id === selectedNodeId) ??
    null;
  const deckNextEdge = deckNowNode
    ? findNextEdge(project.edges, deckNowNode.id)
    : null;
  const deckNextNode = deckNextEdge
    ? (project.nodes.find((node) => node.id === deckNextEdge.toNodeId) ?? null)
    : null;

  // The track a node plays, for the decks.
  function trackForNode(node: TrackNodeData | null) {
    if (!node) return null;
    return project.tracks.find((track) => track.id === node.trackId) ?? null;
  }

  // Set or clear a track's BPM, typed in on a deck. Automatic detection is a
  // later phase and will fill this same field.
  function handleChangeTrackBpm(trackId: string, bpm: number | undefined) {
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) =>
        track.id === trackId ? { ...track, bpm } : track,
      ),
    }));
  }

  // The node a running sequence is playing (or null), used for the status line.
  const nowPlayingNode =
    project.nodes.find((node) => node.id === nowPlayingNodeId) ?? null;

  // Play a node's sound via the (lazily created) audio engine. Called from a
  // user gesture, so this is where the AudioContext first comes to life.
  // A running sequence is stopped first: the two playback modes are exclusive.
  function handlePlayNode(node: TrackNodeData) {
    // stop() clears the "now playing" state, so mark this node after it.
    getSequencePlayer().stop();
    getAudioEngine().playNode(node);
    setNowPlayingNodeId(node.id);
  }

  // Start sequential playback from a node, following edges through the graph.
  function handlePlaySequence(startNode: TrackNodeData) {
    getSequencePlayer().start(project.nodes, project.edges, startNode);
  }

  // Play an edge's transition between its source and target nodes.
  function handlePlayTransition(
    edge: TransitionEdge,
    sourceNode: TrackNodeData,
    targetNode: TrackNodeData,
  ) {
    getSequencePlayer().stop();
    getAudioEngine().playTransition(edge, sourceNode, targetNode);
  }

  // Stop any current playback, including a running sequence.
  function handleStop() {
    getSequencePlayer().stop();
  }

  // Jump to a point in a deck's track, given where along the waveform the
  // click landed (0..1).
  //
  // Seeking inside the node a sequence is playing keeps the sequence running,
  // with its hand-over rescheduled from the new position. Clicking any other
  // deck plays that track from that point instead, which ends the sequence.
  function handleSeek(node: TrackNodeData, ratio: number) {
    const engine = getAudioEngine();
    const offsetSec = offsetFromRatio(ratio, engine.durationForNode(node));
    const sequence = getSequencePlayer();

    if (sequence.isRunning() && sequence.currentNodeId() === node.id) {
      sequence.seek(offsetSec);
      return;
    }

    sequence.stop();
    engine.playNode(node, offsetSec);
    setNowPlayingNodeId(node.id);
  }

  return (
    <div className="app-shell">
    <div className="app-layout">
      <div className="left-column">
        <ProjectToolbar
          canSaveToServer={serverFiles !== null}
          saveStatus={saveStatus}
          onSave={handleSave}
          onExport={handleExport}
          onImportFile={handleImportFile}
        />
        <TrackLibrary
          tracks={project.tracks}
          audioInfo={trackAudioInfo}
          serverFiles={serverFiles}
          usedTrackIds={usedTrackIds}
          onAddToCanvas={handleAddToCanvas}
          onImportAudio={handleImportTrackAudio}
          onChooseServerFile={handleChooseServerFile}
          onAddTrackFromAudio={handleAddTrackFromAudio}
          onRemoveTrack={handleRemoveTrack}
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
          nowPlayingNode={nowPlayingNode}
          onPlayNode={handlePlayNode}
          onPlaySequence={handlePlaySequence}
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
        playingNodeId={nowPlayingNodeId}
        transitioningEdgeId={transitioningEdgeId}
        connectionSourceId={connectionSourceId}
        getPlaybackProgress={getPlaybackProgress}
        onSelectNode={selectNode}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onBackgroundClick={handleBackgroundClick}
        onMoveNode={handleMoveNode}
      />
    </div>
      <DeckPanel
        nowNode={deckNowNode}
        nowTrack={trackForNode(deckNowNode)}
        nextNode={deckNextNode}
        nextTrack={trackForNode(deckNextNode)}
        getPeaks={getTrackPeaks}
        getProgress={getPlaybackProgress}
        onChangeBpm={handleChangeTrackBpm}
        onSeek={handleSeek}
      />
    </div>
  );
}

export default App;
