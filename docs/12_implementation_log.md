# Implementation Log

## 2026-06-11: Phase 0 - Vite React TypeScript Scaffold

### Summary

Phase 0 set up the frontend application foundation for NodeMix Canvas.

The project was scaffolded as a Vite + React + TypeScript application. The default Vite demo content was removed and replaced with a minimal NodeMix Canvas placeholder screen.

### Files Created

* `package.json`
* `package-lock.json`
* `index.html`
* `vite.config.ts`
* `eslint.config.js`
* `tsconfig.json`
* `tsconfig.app.json`
* `tsconfig.node.json`
* `src/App.tsx`
* `src/main.tsx`
* `src/index.css`
* `public/favicon.svg`
* `public/icons.svg`

### Files Intentionally Not Modified

* `CLAUDE.md`
* `README.md`
* `LICENSE`
* `.gitignore`
* `docs/`
* `.github/`

### Files Removed

The default Vite demo files were removed:

* `src/App.css`
* `src/assets/`

### Important Configuration

`vite.config.ts` was updated for the exe.dev environment:

* `server.host: true`
* `server.allowedHosts: 'all'`

### Verification

The development server started successfully with no blocking errors.

```bash
npm run dev
```

Vite started cleanly and reported that the dev server was ready.

### Notes

This phase only created the frontend project foundation. It did not implement domain models, mock data, canvas UI, audio playback, storage, or any product features.

The next implementation step is to add the core domain types and initial mock project data.


## 2026-06-11: Phase 0 - Vite React TypeScript Scaffold

### Summary

Set up the initial frontend foundation using Vite, React, and TypeScript.

The scaffold was created in `/tmp` first, reviewed, then copied into the project root while preserving existing project files such as `README.md`, `.gitignore`, `CLAUDE.md`, `docs/`, and `.github/`.

### Files Added

* `package.json`
* `package-lock.json`
* `index.html`
* `vite.config.ts`
* `eslint.config.js`
* `tsconfig.json`
* `tsconfig.app.json`
* `tsconfig.node.json`
* `src/App.tsx`
* `src/main.tsx`
* `src/index.css`
* `public/favicon.svg`
* `public/icons.svg`

### Files Removed

Removed default Vite demo files:

* `src/App.css`
* `src/assets/`

### Fix Applied

Changed `vite.config.ts`:

```ts
allowedHosts: 'all'
```

to:

```ts
allowedHosts: true
```

Reason: Vite 8 expects `allowedHosts` to be `true` or `string[]`. The string literal `'all'` caused `npm run build` to fail during TypeScript checking.

### Verification

* `git status`: only new scaffold files; no existing tracked files modified
* `git diff --stat`: no existing tracked file changes
* `npm run build`: passed
* `npm run lint`: passed
* `npm run dev`: started successfully

### Status

Phase 0 is ready to commit.

Next step: add domain types and mock project data.


## 2026-06-11: Phase 1 - Domain Types and Mock Project Data

### Summary

Phase 1 created the core domain data layer for NodeMix Canvas.

No UI, audio, or storage features were added. This phase only defined
the data model and a small sample project so later phases have something
to render and manipulate.

The types and mock data follow `docs/04_domain_model.md` exactly.

### Files Created

* `src/domain/types.ts`
* `src/domain/mockProject.ts`

### Files Intentionally Not Modified

* `src/App.tsx` (the screen is unchanged in Phase 1)
* `src/main.tsx`
* `src/index.css`
* `CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`, `.github/`

### What Was Implemented

`src/domain/types.ts` defines the core domain types:

* `Track`
* `TrackNode`
* `TransitionType` (`"cut" | "fade" | "crossfade"`)
* `TransitionEdge`
* `Project`

The types are pure data and do not import React or any UI library, so the
domain model stays independent and JSON-serializable.

`src/domain/mockProject.ts` defines `mockProject`, a small sample graph:

* 2 tracks (Night Drive, Blue Memory)
* 2 nodes
* 1 crossfade edge

Mock IDs use human-readable strings such as `"track-001"`. Runtime-created
entities will use `crypto.randomUUID()` in later phases.

### Verification

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

Results:

* `npm run build`: passed (16 modules, 0 errors)
* `npm run lint`: passed (no warnings, no errors)
* `git status`: only new files under `src/domain/`; no existing tracked files modified
* `git diff --stat`: empty

### Notes

This phase did not render anything. `mockProject` is exported but not yet
imported anywhere; it will be consumed by the Track Library and Canvas in
the next phase.

The next implementation step is to render a static Track Library and a
static Canvas from this mock data.


## 2026-06-11: Phase 2 - Static Track Library and Canvas

### Summary

Phase 2 rendered the mock project data on screen for the first time.

The app now shows a two-column layout: a Track Library on the left and a
Node Canvas on the right. The canvas displays track nodes positioned by
their x/y coordinates and the transition edge connecting them.

This phase is static rendering only. There is no selection, dragging,
edge creation, audio, or storage. No React state is used.

### Files Created

* `src/components/canvasLayout.ts` (shared NODE_WIDTH / NODE_HEIGHT)
* `src/components/TrackLibrary.tsx`
* `src/components/TrackNode.tsx`
* `src/components/EdgeView.tsx`
* `src/components/NodeCanvas.tsx`

### Files Modified

* `src/App.tsx` (imports mockProject, sets up the two-column layout)
* `src/index.css` (minimal layout styles for the panels, canvas, nodes, edges)

### Files Intentionally Not Modified

* `src/domain/types.ts`, `src/domain/mockProject.ts` (data layer unchanged)
* `CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`, `.github/`

### What Was Implemented

* `TrackLibrary` renders every track in `Project.tracks` with title,
  artist (if available), and BPM (if available). No "Add to Canvas" button.
* `TrackNode` renders one node as an absolutely positioned card using the
  node's x/y and a fixed size; the border uses `node.color`. It shows the
  node label and the linked track's artist.
* `EdgeView` renders one edge as an SVG line from the source node center
  to the target node center, with an arrowhead marker for direction.
* `NodeCanvas` renders the SVG edge layer behind and the node cards on top.
  Edges look up their from/to nodes by id; nodes look up their track by id.
* `App` owns `mockProject` and passes data down through plain props.

### Out of Scope (deferred to later phases)

* Node selection and click handling (Phase 3)
* "Add to Canvas" button (Phase 4)
* Edge creation / connection mode (Phase 5)
* Node dragging (Phase 6)
* Inspector Panel and Player Controls
* Audio and storage

### Verification

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run dev     # visual check in the browser
```

Results:

* `npm run build`: passed (22 modules, 0 errors)
* `npm run lint`: passed (no warnings, no errors)
* `npm run dev`: rendered correctly. Both tracks appear in the library;
  both nodes appear on the canvas at their coordinates with their colors;
  the edge connects Night Drive -> Blue Memory with an arrowhead.

### Notes

Node size is fixed (140x60) via `canvasLayout.ts` so the edge geometry can
compute node centers. This is an MVP simplification; variable node sizes
are not needed yet.

The next implementation step is node selection (Phase 3), which will
introduce the first React state and the Inspector Panel.


## 2026-06-11: Phase 3 - Node Selection and Inspector Panel

### Summary

Phase 3 made the canvas interactive for the first time. Clicking a node
selects it (shown with a highlight); clicking the empty canvas background
deselects. The Inspector Panel on the left shows read-only details of the
selected node.

This phase introduced the first React state (`useState`) in the project.
Scope was node selection only (option A): edge selection, edge inspection,
edge editing, node dragging, and the "Start Connection" button were not
implemented.

### Files Created

* `src/components/InspectorPanel.tsx`

### Files Modified

* `src/App.tsx` (holds `selectedNodeId` state; lays out the left column
  with TrackLibrary + InspectorPanel; passes selection props down)
* `src/components/NodeCanvas.tsx` (node click selects; empty canvas click
  deselects; passes `isSelected` / `onSelect` to each node)
* `src/components/TrackNode.tsx` (accepts `isSelected` / `onSelect`; adds
  the selected highlight; stops click propagation so selecting a node does
  not also trigger the canvas deselect)
* `src/index.css` (left-column layout, selected-node highlight, inspector
  panel styles)

### Files Intentionally Not Modified

* `src/domain/*` (data layer unchanged)
* `src/components/EdgeView.tsx` (edges are not selectable in this phase)
* `CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`, `.github/`

### State and Data Flow

* `selectedNodeId: string | null` lives in `App` via `useState`.
* `App` passes `selectedNodeId`, `onSelectNode`, and `onDeselect` to
  `NodeCanvas`, and `selectedNodeId` to `InspectorPanel`.
* `NodeCanvas` calls `onSelectNode(node.id)` on a node click and
  `onDeselect()` on a background click.
* `TrackNode` calls `event.stopPropagation()` then `onSelect()` so its
  click does not bubble up to the canvas deselect handler.
* `InspectorPanel` finds the node by id and renders read-only fields, or a
  "Select a node" placeholder when nothing is selected.

### Out of Scope (deferred to later phases)

* Edge selection and the editable edge inspector form
* "Start Connection" button / edge creation (Phase 5)
* Node dragging (Phase 6)
* Node rename and color editing (read-only in the MVP)
* Player Controls, audio, and storage

### Verification

```bash
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (23 modules, 0 errors)
* `npm run lint`: passed (no warnings, no errors)
* `npm run dev`: verified in the browser:
  - Clicking a node highlights it and fills the Inspector (label, track,
    artist, position, color).
  - Clicking the empty canvas clears the selection and the Inspector shows
    "Select a node".
  - Clicking a different node switches the selection cleanly (the node
    click does not bubble to the canvas deselect).

### Notes

The inspector shows position and color as read-only, matching the MVP
decision that node rename and color editing are out of scope.

The next implementation step is the "Add to Canvas" button (Phase 4),
which will create new nodes at runtime and require the project's nodes to
become state rather than fixed mock data.

## 2026-06-11: Phase 4 - Add to Canvas (track-to-canvas node creation)

### Summary

Phase 4 made the project mutable for the first time. Each track in the Track
Library now has an "Add to Canvas" button. Clicking it creates a new node from
that track, appends it to the project, and selects the new node so its details
appear in the Inspector Panel.

### Files Modified

* `src/App.tsx` - project is now `useState<Project>(mockProject)`; added
  `handleAddToCanvas(trackId)`; aliased the `TrackNode` type to `TrackNodeData`
  to avoid colliding with the `TrackNode` component.
* `src/components/TrackLibrary.tsx` - added the `onAddToCanvas` prop and an
  "Add to Canvas" button per track.
* `src/index.css` - styling for `.add-to-canvas-button`.

### Files Intentionally Not Modified

* `src/domain/types.ts`, `src/domain/mockProject.ts` - the data model already
  supports runtime nodes; only the seed data is reused.
* `src/components/NodeCanvas.tsx`, `TrackNode.tsx`, `InspectorPanel.tsx` - they
  already render from props, so added nodes show up with no change.

### State and Data Flow

* `App` owns `project` (state) and `selectedNodeId` (state).
* `TrackLibrary` calls `onAddToCanvas(track.id)`.
* `handleAddToCanvas` looks up the track, builds a new `TrackNode`
  (`crypto.randomUUID()` id, default color `#64748B`, position
  `200 + nodes.length * 30`), appends it immutably via `setProject`, and sets
  it as the selected node.
* `NodeCanvas` and `InspectorPanel` re-render from the updated project.

### Out of Scope (deferred to later phases)

* **Node deletion** - handled separately in Phase 4.5.
* Drag to reposition nodes (writes x/y back to the project).
* Edge creation / "Start Connection".
* Project JSON import/export, audio playback, crossfade, localStorage.

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (23 modules, 0 errors)
* `npm run lint`: passed (no warnings, no errors)
* `npm run dev`: verified in the browser:
  - Each track shows an "Add to Canvas" button.
  - Clicking it adds a node to the canvas, auto-selects it, and fills the
    Inspector with the new node's details.
  - The same track can be added multiple times; nodes are offset so they do
    not fully overlap.

### Notes

There is no way to remove a node yet. Node deletion is implemented next in
Phase 4.5 ("Delete selected node"), which adds a Delete button to the Inspector
Panel and also removes edges connected to the deleted node.

## 2026-06-11: Phase 4.5 - Delete selected node

### Summary

Phase 4.5 added node deletion, the follow-up noted at the end of Phase 4. The
Inspector Panel now shows a "Delete node" button when a node is selected.
Clicking it removes the node (and any edges connected to it) from the project
and clears the selection.

### Files Modified

* `src/App.tsx` - added `handleDeleteNode(nodeId)` which filters the node out
  of `project.nodes` and filters out edges whose `fromNodeId`/`toNodeId` match
  the deleted node, then sets `selectedNodeId` to null. Passed `onDeleteNode`
  to the Inspector.
* `src/components/InspectorPanel.tsx` - added the `onDeleteNode` prop and a
  "Delete node" button rendered only in the branch where a node is selected.
* `src/index.css` - styling for `.delete-node-button` (a low-key red).

### Files Intentionally Not Modified

* `src/domain/types.ts` - the edge field names (`fromNodeId`, `toNodeId`) were
  confirmed here before writing the edge cleanup; no type changes were needed.
* `src/components/NodeCanvas.tsx`, `TrackNode.tsx`, `TrackLibrary.tsx` - they
  render from props and update automatically when the project changes.

### State and Data Flow

* `App` owns `project` and `selectedNodeId`.
* The Inspector calls `onDeleteNode(node.id)`.
* `handleDeleteNode` updates the project immutably (filter nodes + filter
  edges) and clears the selection, so the Inspector falls back to its
  "Select a node" placeholder and the canvas re-renders without the node.

### Out of Scope (deferred to later phases)

* Delete / Backspace keyboard shortcut.
* Drag-to-trash deletion.
* Confirmation dialog before deleting.
* Drag to reposition, edge creation, import/export, audio, crossfade.

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors)
* `npm run lint`: passed (no warnings, no errors)
* `npm run dev`: verified in the browser:
  - The Delete button appears only when a node is selected.
  - Clicking it removes the node from the canvas and clears the Inspector back
    to "Select a node".
  - Deleting node-001 (which has a connected edge in the mock data) also
    removes that edge; no dangling edge remains.

## 2026-06-11: Phase 5 - Drag nodes

### Summary

Phase 5 made nodes draggable on the canvas. Pressing the mouse on a node
selects it and starts a drag; moving the mouse updates the node's x/y in the
project; releasing ends the drag. Connected edges follow automatically because
EdgeView derives its geometry from the nodes' x/y.

### Files Modified

* `src/App.tsx` - added `handleMoveNode(nodeId, x, y)`, which replaces the
  dragged node's x/y in `project.nodes` via `map` (immutable update). Passed
  `onMoveNode` to NodeCanvas.
* `src/components/NodeCanvas.tsx` - created the canvas `useRef` and attached it
  to the canvas element; passed the ref and an `onMove` callback to each
  TrackNode.
* `src/components/TrackNode.tsx` - added the drag logic: `mousedown` selects and
  starts the drag, `window` `mousemove` converts pointer coordinates to
  canvas-relative x/y (using the canvas ref and a pointer/corner offset) and
  calls `onMove`, `mouseup` removes the listeners. A `didDrag` ref suppresses
  the trailing click after a real drag.
* `src/index.css` - `cursor: grab` / `:active` `grabbing`, and `user-select:
  none` on the node so dragging does not select the label text.

### Files Intentionally Not Modified

* `src/components/EdgeView.tsx` - already computes line endpoints from each
  node's x/y, so edges follow moved nodes without any change.
* `src/domain/types.ts`, `mockProject.ts` - no data-model change needed.

### State and Data Flow

* `App` owns `project` and `selectedNodeId`.
* `NodeCanvas` owns the canvas DOM ref and passes it down (nodes never query the
  DOM directly).
* On drag: TrackNode computes the new canvas-relative x/y and calls
  `onMove(x, y)` -> `onMoveNode(id, x, y)` -> `setProject` updates that node.
* NodeCanvas re-renders the node at its new position and EdgeView re-renders any
  connected edges.

### Out of Scope (deferred to later phases)

* Coordinate clamping to the canvas bounds.
* Edge creation / "Start Connection".
* Project JSON import/export, audio playback, crossfade.

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors)
* `npm run lint`: passed (no warnings, no errors)
* `npm run dev`: verified in the browser:
  - Dragging the Night Drive node moved it (x:100,y:160 -> x:300,y:410) and the
    Inspector position updated live.
  - The connected edge followed the node to its new position.
  - The node stayed selected during and after the drag.
  - A plain click (no movement) still selects a different node normally.

## 2026-06-21: Phase 6 - JSON save/load (export/import)

### Summary

The project can now be exported to a JSON file and imported back. A new
Project Toolbar holds the Export JSON and Import JSON actions. Pure
serialize/parse logic lives in a React-free storage module and is covered by
unit tests (first tests in the project, using Vitest).

### Files Modified

* `src/storage/projectStorage.ts` (new) - `serializeProject`, `parseProject`,
  and `downloadProject`. The first two are pure; `downloadProject` does the DOM
  download.
* `src/storage/projectStorage.test.ts` (new) - Vitest unit tests for the pure
  functions (round-trip, invalid JSON, missing field, wrong type).
* `src/components/ProjectToolbar.tsx` (new) - Export / Import buttons; the
  Import button opens a hidden `<input type="file" accept=".json">`.
* `src/App.tsx` - added `handleExport` and `handleImportFile`; renders
  `ProjectToolbar` above `TrackLibrary` in the left column.
* `src/index.css` - styles for `.project-toolbar`, `.toolbar-button`, and the
  hidden file input.
* `package.json` - added `vitest` (devDependency) and a `"test": "vitest run"`
  script.

### Files Intentionally Not Modified

* `src/domain/types.ts`, `mockProject.ts` - the saved JSON matches the existing
  `Project` type exactly; no data-model change needed.
* `src/components/TrackLibrary.tsx` - kept free of save/load UI; the toolbar is
  a separate component.

### State and Data Flow

* Export: `handleExport` calls `downloadProject(project)`, which serializes the
  current project (two-space indent) and triggers a `<title>.json` download via
  a temporary `<a>` + blob URL.
* Import: `ProjectToolbar` reads the chosen `File` and calls
  `onImportFile(file)`. `App.handleImportFile` uses `FileReader` to read the
  text, `parseProject` to validate it, then `setProject(loaded)` and
  `setSelectedNodeId(null)`.
* On any parse/validation error, the current project is left unchanged and a
  simple `window.alert` shows the message.

### Out of Scope (deferred to later phases)

* Edge creation / "Start Connection".
* Audio playback and crossfade.
* Deep validation of nested fields, schema versioning, auto-save, undo/redo.
* React Testing Library / end-to-end tests (only pure-function unit tests for
  now).

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run test    # vitest run
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors).
* `npm run lint`: passed (no warnings, no errors).
* `npm run test`: passed (5 tests in `projectStorage.test.ts`).
* `npm run dev`: verified in the browser:
  - Export JSON produced a `application/json` blob with two-space indentation
    and the full `Project` shape (`id, title, tracks, nodes, edges`).
  - Importing a valid project file replaced the project (library + canvas
    showed the imported track) and cleared the selection.
  - Importing invalid JSON showed an "Import failed" alert and left the current
    project unchanged.

## 2026-06-21: Phase 7 - Edge creation (Start Connection flow)

### Summary

The user can now create a transition edge between two nodes using the two-step
click flow: select a source node, click "Start Connection" in the Inspector,
then click a target node. The canvas shows a connection mode (source node
highlighted, hint in the Inspector). Clicking the source again or clicking
empty space cancels. New edges use the agreed defaults.

### Files Modified

* `src/App.tsx` - new `connectionSourceId` state; `handleStartConnection`,
  `handleNodeClick` (branches on connection mode), and `handleBackgroundClick`
  (cancels in connection mode, otherwise deselects). Creates a `TransitionEdge`
  with `crypto.randomUUID()` and defaults `crossfade` / `fadeDurationSec: 3`.
* `src/components/InspectorPanel.tsx` - "Start Connection" button (shown when a
  node is selected and not connecting); a hint replaces it during connection
  mode.
* `src/components/NodeCanvas.tsx` - takes `connectionSourceId`, `onNodeClick`,
  `onBackgroundClick`; adds `connecting` class; passes connection flags to each
  node.
* `src/components/TrackNode.tsx` - suppresses drag entirely while connecting;
  routes clicks through `onClickNode`; adds `connection-source` class. Keeps the
  existing `stopPropagation` on mousedown and click so a node click never
  reaches the canvas background.
* `src/index.css` - styles for the Start Connection button, the Inspector hint,
  the connection-source outline, and the crosshair cursor in connection mode.

### Files Intentionally Not Modified

* `src/components/EdgeView.tsx` - already renders an edge from the from/to node
  centers, so a newly created edge appears with no change.
* `src/domain/types.ts`, `mockProject.ts` - `TransitionEdge` already exists.

### State and Data Flow

* `App` owns `connectionSourceId` (null = normal mode).
* mousedown on a node: `stopPropagation` (never reaches the canvas); in
  connection mode it returns immediately so no drag starts.
* click on a node: `stopPropagation`, then `onClickNode` -> `handleNodeClick`.
  In connection mode a click on a different node appends a new edge and exits
  connection mode (source stays selected); a click on the source cancels.
* click on the canvas background: `handleBackgroundClick` cancels the connection
  in connection mode, otherwise deselects.

### New Edge Defaults

* `id`: `crypto.randomUUID()`
* `transitionType`: `"crossfade"`
* `fadeDurationSec`: `3`
* `note`: omitted (undefined)

### Out of Scope (deferred to later phases)

* Selecting and editing edges (transitionType / fadeDurationSec / note form).
* Preventing duplicate edges between the same pair (only self-loops are
  blocked).
* Drag-to-connect (not part of the MVP).
* Audio playback and crossfade.

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run test    # vitest run
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors).
* `npm run lint`: passed (no warnings, no errors).
* `npm run test`: passed (5 existing storage tests still green).
* `npm run dev`: verified in the browser:
  - Start Connection enters connection mode (canvas `connecting` class, source
    node dashed outline, Inspector hint).
  - Clicking a different node creates an edge (defaults: crossfade / 3 / no
    note / UUID id) and exits connection mode; the source stays selected.
  - While connecting, dragging the source node does not move it.
  - Clicking the source node again cancels (no edge created).
  - Clicking empty canvas space cancels (no edge, selection preserved).

## 2026-06-21: Phase 7.5 - Edge selection and delete

### Summary

Clicking an edge on the canvas now selects it; the Inspector shows the
connection's basic info (from -> to, transition type, fade duration) and a
"Delete connection" button that removes just that edge. Node and edge selection
are mutually exclusive. Editing an edge is not part of this phase.

### Files Modified

* `src/App.tsx` - new `selectedEdgeId` state; `selectNode` / `selectEdge`
  wrappers that keep node and edge selection exclusive; `handleEdgeClick`
  (ignored while connecting); `handleDeleteEdge`. `handleDeleteNode` and
  `handleBackgroundClick` now also clear the edge selection. JSON import clears
  `selectedNodeId`, `selectedEdgeId`, and `connectionSourceId`.
* `src/components/EdgeView.tsx` - renders a wide transparent "hit line" on top
  of the visible line; clicking it stops propagation and calls `onSelect`. The
  visible line gets a `selected` style when chosen.
* `src/components/NodeCanvas.tsx` - passes `selectedEdgeId` and `onEdgeClick` to
  each `EdgeView`.
* `src/components/InspectorPanel.tsx` - shows the edge view (read-only info +
  Delete connection) when an edge is selected; otherwise the node view; the
  empty placeholder now reads "Select a node or connection".
* `src/index.css` - `.edge-hit` (transparent, `stroke-width: 12`,
  `pointer-events: stroke`), `.edge-line.selected` (accent, thicker), the
  visible `.edge-line` set to `pointer-events: none`, and `.delete-edge-button`.

### Files Intentionally Not Modified

* `src/domain/types.ts`, `mockProject.ts` - no data-model change.
* `src/components/TrackNode.tsx` - node behavior is unchanged.

### SVG Hit Area

* `.edge-layer` stays `pointer-events: none` so the SVG never blocks node
  clicks; only the per-edge hit line opts back in.
* The visible `.edge-line` is `pointer-events: none`; a separate transparent
  `.edge-hit` line (12px wide, `pointer-events: stroke`) catches the click, so
  the thin 2px edge is easy to hit.
* Verified in the browser that `document.elementFromPoint` at the edge midpoint
  returns the `.edge-hit` element and selecting it works.

### State and Data Flow

* `App` owns `selectedNodeId` and `selectedEdgeId`; `selectNode` / `selectEdge`
  always null the other, so at most one is set.
* Edge click: `EdgeView` stops propagation (so it never reaches the canvas
  background) and calls `onEdgeClick` -> `handleEdgeClick`. While connecting,
  `handleEdgeClick` returns immediately (no selection).
* Delete: `handleDeleteEdge` filters the one edge out of `project.edges` and
  clears `selectedEdgeId`.

### Out of Scope (deferred to later phases)

* Editing an edge: `transitionType`, `fadeDurationSec`, and `note` editing.
* Duplicate-edge and self-loop handling (unchanged from Phase 7).
* Audio playback and crossfade.

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run test    # vitest run
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors).
* `npm run lint`: passed (no warnings, no errors).
* `npm run test`: passed (5 existing storage tests still green).
* `npm run dev`: verified in the browser:
  - Clicking the edge selects it (accent highlight) and shows the connection
    info + Delete connection; any selected node is deselected.
  - Clicking a node deselects the edge (reverse exclusivity).
  - Clicking empty canvas space clears the edge selection.
  - Delete connection removes only that edge; both nodes remain.
  - Phase 7 regression: the Start Connection flow still creates edges, and
    clicking an edge while in connection mode does nothing (and does not cancel
    the connection).

## 2026-06-21: Phase 8 - Simple audio playback (oscillator)

### Summary

The app now makes sound. A new AudioEngine plays a short tone for the selected
node and stops it. The engine uses an OscillatorNode as a placeholder source
(no audio files yet); each node gets a stable, distinct frequency and waveform.
The UI (PlayerControls) only triggers high-level callbacks and never touches
the Web Audio API.

### Files Modified / Added

* `src/audio/audioEngine.ts` (new) - `AudioEngine` class with `playNode(node)`,
  `stop()`, and `dispose()`. Wiring is `source -> gain -> destination`. The
  source is built in `createSourceForNode`, the single swap point for future
  audio-file playback.
* `src/audio/nodeSound.ts` (new) - pure `hashString` and `soundForNode`: map a
  node id to a stable frequency + waveform. No Web Audio API, so it is unit
  testable.
* `src/audio/nodeSound.test.ts` (new) - 5 Vitest tests (determinism,
  non-negative hash, valid waveform, distinct sounds).
* `src/components/PlayerControls.tsx` (new) - Play / Stop buttons + a status
  line. Calls `onPlay(node)` / `onStop`; knows nothing about the engine.
* `src/App.tsx` - lazily creates one `AudioEngine` via `useRef<AudioEngine |
  null>(null)` + `getAudioEngine()`; `handlePlayNode` / `handleStop` wrap it;
  a `useEffect` cleanup calls `dispose()` on unmount; renders `PlayerControls`
  under the Inspector.
* `src/index.css` - styles for `.player-controls`, `.player-button` (incl.
  disabled), and `.player-status`.

### Files Intentionally Not Modified

* `src/domain/types.ts`, `mockProject.ts` - no data-model change. `audioUrl`
  stays unused for now.
* Canvas / Inspector / edge components - unchanged.

### Lazy Engine and Single AudioContext

* The `AudioEngine` ref starts null; the instance is created on first access.
* The instance does not open an `AudioContext` in its constructor. The context
  is created lazily inside `playNode` (the first user gesture), satisfying the
  browser autoplay policy, and is reused for all later playback.
* `dispose()` stops playback and closes the context.

### UI / Engine Separation

* `PlayerControls` receives `onPlay` / `onStop` callbacks, not the engine. The
  engine ref is only read inside event handlers in `App`, never during render.
* Oscillator, frequency, and waveform live entirely in `src/audio`; the UI
  never sees them.

### Out of Scope (deferred)

* Fade and crossfade (Phase 13).
* Loading `node.audioUrl`, `AudioBuffer` decoding, real/Suno audio (later
  phase).
* Playing multiple nodes at once (one voice at a time in the MVP).

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run test    # vitest run
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors).
* `npm run lint`: passed (no warnings, no errors).
* `npm run test`: passed (10 tests: 5 storage + 5 nodeSound).
* `npm run dev`: verified in the browser (programmatically, since sound is not
  audible in the headless tool):
  - With no node selected, Play is disabled and the status reads "No node
    selected".
  - Selecting a node enables Play and does NOT create an AudioContext yet
    (lazy).
  - Clicking Play creates exactly one AudioContext and starts one oscillator.
  - Playing a second node stops the first oscillator and starts a new one
    (single voice); the AudioContext count stays 1 (no overlapping contexts).
  - Stop stops the current oscillator.
  - Whether sound is actually audible is left to the user's own manual check.

## 2026-06-21: Phase 9 - Crossfade (transition playback)

### Summary

The app can now play a transition between two connected nodes. Selecting an
edge shows a "Play transition" button in PlayerControls; it plays the edge's
source and target according to `transitionType` (cut / fade / crossfade), using
`fadeDurationSec`. This is a preview between the source and target nodes, not a
full DJ transition from a currently-playing track. This completes MVP step 13.

### Files Modified / Added

* `src/audio/audioEngine.ts` - added `playTransition(edge, sourceNode,
  targetNode)`; changed single `currentVoice` to an `activeVoices: Voice[]`
  list (crossfade needs two voices); extracted `startVoice` and small ramp
  helpers; `stop()` now stops and disconnects every active voice.
* `src/audio/transitionTiming.ts` (new) - pure `sanitizeFadeDuration` plus
  `MIN_FADE_SECONDS` (0.01) and `MAX_FADE_SECONDS` (60).
* `src/audio/transitionTiming.test.ts` (new) - 5 Vitest tests for the clamp
  (normal, zero/negative, NaN/Infinity, too-large, boundary).
* `src/components/PlayerControls.tsx` - switches on selection: node -> Play,
  edge -> Play transition, nothing -> Play disabled; Stop is always enabled.
* `src/App.tsx` - derives `selectedEdge` and its source/target nodes; adds
  `handlePlayTransition`; passes the new props to PlayerControls.

### Files Intentionally Not Modified

* `src/components/InspectorPanel.tsx` - unchanged: still shows edge info and the
  Delete connection button.
* `src/domain/types.ts`, `mockProject.ts` - no data-model change.

### Transition Behavior

* `cut`: play only the target immediately (tiny fade-in to avoid a click).
* `fade`: fade the source out over `fade`, then start the target.
* `crossfade`: play both at once, source PLAY_GAIN->0 and target 0->PLAY_GAIN
  over `fade`.
* `fadeDurationSec` is sanitized: anything not finite or <= 0.01 becomes 0.01s
  (almost instant); values over 60s are capped.

### Voice Management

* `activeVoices` holds every scheduled/playing voice (one for playNode/cut, two
  for fade/crossfade).
* Each play call first calls `stop()`, so a new Play / Play transition cancels
  the previous one.
* `stop()` ramps each voice's gain to 0, stops the source, and disconnects, then
  clears the list - so a Stop during a crossfade cleans up both voices.
* The AudioContext is still created lazily on the first play and reused.

### UI / Engine Separation

* PlayerControls only calls `onPlayNode` / `onPlayTransition` / `onStop`. It
  knows nothing about oscillators, gains, or the AudioContext; the engine ref is
  only read inside App event handlers.

### Out of Scope (deferred)

* Loading `node.audioUrl`, AudioBuffer decoding, real/Suno audio.
* Editing `transitionType` / `fadeDurationSec` from the UI.
* Playing a transition from an already-playing track (real DJ behavior).

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run test    # vitest run
npm run dev     # manual check in the browser
```

Results:

* `npm run build`: passed (0 errors).
* `npm run lint`: passed (no warnings, no errors).
* `npm run test`: passed (15 tests: 5 storage + 5 nodeSound + 5
  transitionTiming).
* `npm run dev`: verified in the browser (programmatically; sound is not
  audible in the headless tool):
  - Nothing selected: Play disabled, Stop enabled, status "Nothing selected".
  - Node selected: Play / Stop, status "Selected: <label>".
  - Edge selected: Play transition / Stop, status "Transition: <from> -> <to>
    (crossfade)"; the Inspector is unchanged.
  - Play transition on the crossfade edge starts two oscillators at once; the
    AudioContext count stays 1.
  - Stop stops all active voices; a new Play transition stops the previous pair
    first.
  - Whether sound is actually audible is left to the user's own manual check.

## 2026-07-12: Phase 10 - Edge editing (transition type and fade duration)

### Summary

The Inspector's edge view is now editable: a select changes the selected
edge's `transitionType` (cut / fade / crossfade) and a number input changes
its `fadeDurationSec`. The consistency rules live in a new pure domain module
`src/domain/edgeRules.ts`: switching to `cut` zeroes the fade (and the input
is disabled), switching to `fade`/`crossfade` from a 0 fade resets it to the
default 3, and invalid input (NaN from an emptied field, negatives) clamps
to 0. This closes the last gap in the MVP Definition of Done item "A user can
define a simple transition"; see the 2026-07-12 decision log entry.

### Files Modified

* `src/domain/edgeRules.ts` (new) - `DEFAULT_FADE_SECONDS`,
  `changeTransitionType`, `changeFadeDuration`; pure, React-free, documented
  against the decision log rules.
* `src/domain/edgeRules.test.ts` (new) - 8 unit tests for the rules above,
  including immutability and the cut-stays-at-0 guard.
* `src/App.tsx` - `updateEdge` helper (replace one edge via an update
  function); `handleChangeEdgeTransitionType` / `handleChangeEdgeFadeDuration`
  delegating to edgeRules; new-edge creation now uses `DEFAULT_FADE_SECONDS`
  instead of a literal 3; the two handlers are passed to InspectorPanel.
* `src/components/InspectorPanel.tsx` - the edge view's read-only Transition
  and Fade rows become a labeled select and number input. The panel only
  reports the user's choice; App applies the rules. The fade input is
  disabled while the type is `cut`.
* `src/index.css` - `.inspector-select`, `.inspector-number-input` (+
  disabled state), `.inspector-unit`.

### Files Intentionally Not Modified

* `src/audio/*` - playback already reads `transitionType` /
  `fadeDurationSec` from the edge on each play; no engine change is needed
  for edited values to take effect.
* `src/storage/projectStorage.ts` - edited values serialize with the
  existing export/import as plain fields.

### State and Data Flow

* Edits go InspectorPanel -> App callback -> `updateEdge` ->
  `setProject`, replacing only the one edge object. PlayerControls' status
  line updates automatically because it derives from the selected edge.
* The cast `event.target.value as TransitionType` is safe because the
  select's options come from a `TRANSITION_TYPES` list typed as
  `TransitionType[]`.

### Out of Scope (deferred)

* Editing `note` (listed as optional in `docs/05_ui_requirements.md`).
* Any fade-duration upper bound in the UI; playback already clamps via
  `sanitizeFadeDuration` (60s max).
* Real audio, file import, and everything else post-MVP.

### Verification

```
npm run build   # tsc -b && vite build
npm run lint    # eslint .
npm run test    # vitest run
```

Results:

* `npm run build`: passed (0 errors).
* `npm run lint`: passed (no warnings, no errors).
* `npm run test`: passed (23 tests: 5 storage + 5 nodeSound + 5
  transitionTiming + 8 edgeRules).
* Browser verification (Playwright + headless Chromium against
  `npm run dev`, driving the real UI; recipe recorded in
  `.claude/skills/verify/SKILL.md`):
  - Selecting the mock edge shows the select (crossfade) and fade input (5).
  - Switch to cut: fade shows 0 and the input is disabled.
  - Switch to fade: fade resets to the default 3.
  - Typing 7.5 sticks; the player status line follows the type live.
  - Emptying the field or typing a negative value clamps to 0.
  - Play transition -> Stop with edited values: no console errors.
  - Deselect + reselect: edited values persist in the project state.
  - Audible playback is left to the user's manual check (the VM has no
    audio output).
