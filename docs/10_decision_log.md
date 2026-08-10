# Decision Log

## 2026-06-10: MVP Interaction Decisions

### Context

Claude reviewed `CLAUDE.md` and the files in `docs/`.

It identified several ambiguous areas in the MVP design, especially around:

- how tracks are added to the canvas
- how edges are created
- how playback starts
- how multiple outgoing edges are handled
- how fade and crossfade differ
- how project storage should work

These decisions were made before implementation to prevent Claude from inventing behavior during coding.

---

## Decisions

### 1. Track-to-canvas interaction

Decision:

- v0.1: render nodes from mock data only.
- v0.2: add an "Add to Canvas" button in the Track Library.
- v0.3 or later: support drag-and-drop from Track Library to Canvas.

Reason:

Drag-and-drop is part of the long-term product vision, but it adds UI complexity too early.  
The MVP should first prove the data model and node graph structure.

---

### 2. Edge creation

Decision:

Use a simple two-step interaction:

1. Select a source node.
2. Click "Start Connection".
3. Click a target node.
4. Create a directed edge from source to target.

Reason:

Drag-to-connect is more visually natural, but it is more complex.  
The first version should prioritize understandable implementation.

---

### 3. Playback target

Decision:

- A selected node can be played with "Play Track".
- A selected edge can be played with "Play Transition".
- If a node has multiple outgoing edges, the app should not choose automatically.

Reason:

Automatic edge selection would hide user intention.  
A DJ-style tool should let the user choose the transition explicitly.

---

### 4. Transition semantics

Decision:

- `cut`: stop the first track immediately and start the second track.
- `fade`: fade out the first track, then start the second track.
- `crossfade`: fade out the first track while fading in the second track at the same time.

Reason:

This keeps each transition type distinct and easy to implement.

---

### 5. fadeDurationSec

Decision:

- Keep `fadeDurationSec` required.
- For `cut`, use `fadeDurationSec: 0`.
- For `fade` and `crossfade`, use a positive number.

Reason:

Keeping the field required simplifies the data model.  
The meaning for `cut` is handled by convention.

---

### 6. Track library

Decision:

For the MVP, `Project.tracks` is the track library.

Reason:

A separate global library would add complexity before it is needed.

---

### 7. audioUrl

Decision:

- `audioUrl` is optional.
- Early UI steps must work without real audio files.
- Real audio files will be added only when implementing playback.

Reason:

The UI and graph model can be built before audio playback.  
This avoids blocking early development on audio file preparation.

---

### 8. TrackNode.label

Decision:

- Initialize `TrackNode.label` from `Track.title`.
- Do not implement node renaming in the MVP.
- Keep `label` for future flexibility.

Reason:

Eventually, a node may need a custom label independent of the original track title.  
For now, the UI does not need rename behavior.

---

### 9. TrackNode.color

Decision:

- Use mock colors or automatic colors.
- Do not implement color editing in the MVP.

Reason:

Color is useful for visual distinction, but color editing is not core to the first prototype.

---

### 10. Canvas coordinates

Decision:

`x` and `y` are CSS pixel coordinates relative to the top-left corner of the canvas.

Reason:

This is the simplest coordinate system for the MVP.

---

### 11. ID generation

Decision:

Use `crypto.randomUUID()` for runtime-created entities.

Reason:

It is built into modern browsers and avoids manual counter logic.

---

### 12. AudioEngine access pattern

Decision:

Create one AudioEngine instance at the app level and pass it to components through props.

Reason:

React Context is unnecessary until the app grows.  
Props are easier to understand for the first implementation.

---

## Deferred Features

These are intentionally not implemented in the MVP:

- drag-and-drop from track library
- drag-to-connect edges
- node renaming
- color editing
- BPM detection
- beat matching
- waveform display
- Spotify integration
- Suno integration
- AI-assisted editing
- backend
- accounts
- cloud sync

---

## Next Step

Update the following docs based on these decisions:

- `docs/05_ui_requirements.md`
- `docs/07_project_storage.md`

Then proceed to implementation step 1:

- create `src/domain/types.ts`

## 2026-06-10: Node Placement and Edge Defaults

> Note (2026-06-11): This section originally appeared twice as two near-duplicate
> entries with the same title. They have been merged into this single entry. The
> node-placement formula recorded here was a pre-implementation plan; the value
> actually shipped differs (see "Implementation note" below and the Phase 4 entry).

### Context

After reviewing the MVP docs, a few remaining ambiguities were clarified before
writing application code. The main open questions were:

- where newly added nodes should appear on the canvas
- what default values should be used when creating a new transition edge

### Decisions

#### 1. Default placement for newly added nodes

When the user clicks "Add to Canvas", the new node is placed automatically using
a simple deterministic rule.

- The first node starts near the top-left of the canvas.
- Additional nodes are offset from previous nodes to avoid full overlap.
- Coordinates are CSS pixels relative to the top-left corner of the canvas.

Originally planned formula (grid layout):

```ts
x = 120 + (nodeCount % 5) * 80;
y = 120 + Math.floor(nodeCount / 5) * 80;
```

This is MVP-only behavior. Advanced layout, zoom-aware placement,
center-of-canvas placement, and drag-and-drop placement are deferred.

**Implementation note (2026-06-11, Phase 4):** the shipped code uses a simpler
diagonal offset instead of the grid formula above:

```ts
x = 200 + nodes.length * 30;
y = 200 + nodes.length * 30;
```

The diagonal offset was chosen during implementation because it is trivial to
read and good enough to keep repeated additions from fully overlapping. The grid
formula above is kept only as the original plan, not as the current behavior.
See the Phase 4 entry for the authoritative decision.

#### 2. Default values for new edges

When a new edge is created, use:

- transitionType: "crossfade"
- fadeDurationSec: 3
- note: undefined

Rules for `fadeDurationSec`:

- If transitionType is changed to `"cut"`, set `fadeDurationSec` to 0.
- If transitionType is changed to `"fade"` or `"crossfade"` and `fadeDurationSec`
  is 0, reset it to a positive number (3).

**Status:** Implemented. The new-edge defaults were built in Phase 7 (edge
creation); the `fadeDurationSec` rules for type changes were built in Phase 10
(edge editing, 2026-07-12) as pure helpers in `src/domain/edgeRules.ts`.

### Deferred

The following are not implemented yet:

- drag-and-drop placement from the track library
- advanced auto-layout
- zoom-aware canvas behavior
- audio file selection
- real audio playback

## 2026-06-11: Phase 1 Implementation Decisions

### Context

Phase 1 implemented the domain data layer (`src/domain/types.ts` and
`src/domain/mockProject.ts`). A few small decisions were made while turning
the `docs/04_domain_model.md` definitions into actual files.

### Decisions

#### 1. Split types and mock data into two files

Decision:

* Put type definitions in `src/domain/types.ts`.
* Put the sample project in `src/domain/mockProject.ts`.

Reason:

This matches the suggested directory structure in `CLAUDE.md` and keeps
the type definitions separate from sample data, so mock data can change
without touching the types.

#### 2. Import the Project type with `import type`

Decision:

`mockProject.ts` uses `import type { Project } from "./types"`.

Reason:

The import is only needed for type-checking, not at runtime. Using
`import type` makes that intent explicit and keeps the domain layer free
of unnecessary runtime imports.

#### 3. Do not modify the UI in Phase 1

Decision:

`src/App.tsx` was left unchanged. The mock data is exported but not yet
rendered.

Reason:

Phase 1 is strictly the data layer. Keeping the change small makes it easy
to review and avoids mixing data-model work with UI work. Rendering begins
in the next phase.

#### 4. Copy mock data verbatim from the domain model doc

Decision:

The contents of `mockProject` (tracks, nodes, edge) were taken directly
from the Example Project in `docs/04_domain_model.md` rather than invented.

Reason:

`CLAUDE.md` instructs not to invent requirements. The doc already provides
an agreed-upon sample, so reusing it keeps a single source of truth.

## 2026-06-11: Phase 2 Implementation Decisions

### Context

Phase 2 rendered the Track Library and Node Canvas statically from
`mockProject`. A few small decisions were made while building the first
UI components.

### Decisions

#### 1. Render only Library + Canvas (no Inspector/Player placeholders)

Decision:

Phase 2 renders only the Track Library and Node Canvas. The Inspector
Panel and Player Controls regions are not added yet, not even as empty
placeholders.

Reason:

This keeps the change minimal and focused on "data to pixels". The full
four-region layout will come as those regions get real behavior.

#### 2. Fixed node size via a shared constants file

Decision:

Node size is fixed at 140x60, defined in `src/components/canvasLayout.ts`
and shared by `TrackNode` (rendering) and `EdgeView` (line geometry).

Reason:

Edges need to compute node centers to draw lines. A shared constant keeps
the rendered card and the edge math in sync without measuring the DOM.
Variable node sizes are unnecessary for the MVP.

#### 3. Edges as an SVG layer behind the nodes

Decision:

Edges are drawn in a single SVG layer positioned absolutely behind the
node cards, using a line from source-center to target-center plus a shared
arrowhead marker for direction. The SVG layer uses `pointer-events: none`.

Reason:

SVG is the simplest way to draw directional lines and arrowheads. Putting
it behind the nodes keeps the cards readable, and disabling pointer events
ensures it will not interfere with node interactions in later phases.

#### 4. No React state in Phase 2

Decision:

Data flows from `App` down through plain props. No `useState` or event
handlers are introduced.

Reason:

Phase 2 is pure static rendering. State belongs with selection (Phase 3),
where it is actually needed. Keeping it out now makes the rendering layer
simple to read.

## 2026-06-11: Phase 3 Implementation Decisions

### Context

Phase 3 added node selection and the Inspector Panel. The work was scoped
to node selection only (option A). A few small decisions were made while
introducing the first React state.

### Decisions

#### 1. Node selection only (option A)

Decision:

Implement node selection and a read-only node Inspector. Do not implement
edge selection, the editable edge inspector, edge editing, node dragging,
or the "Start Connection" button.

Reason:

This keeps the change small and matches the branch scope. The edge
inspector is an editable form (transitionType, fadeDurationSec, note) and
is naturally its own step. Selection alone is enough to introduce React
state cleanly.

#### 2. Selection state lives in App

Decision:

`selectedNodeId: string | null` is held in `App` with `useState` and
passed down through props (`selectedNodeId`, `onSelectNode`, `onDeselect`).

Reason:

`App` is the common parent of the canvas (which changes the selection) and
the inspector (which reads it). Per `CLAUDE.md`, props are preferred over
React Context until prop drilling becomes unmanageable, which it has not.

#### 3. Store only the id, not the node object

Decision:

State stores `selectedNodeId` (a string), not the selected node object.
Components look the node up by id.

Reason:

The id is the stable source of truth. Storing only the id avoids keeping a
duplicate copy of node data in state that could drift from the project
data, which matters once nodes become editable in later phases.

#### 4. Stop click propagation on the node

Decision:

A node's click handler calls `event.stopPropagation()` before selecting.

Reason:

The canvas background has a click handler that deselects. Without stopping
propagation, a node click would bubble to the canvas and immediately
deselect the node. Stopping propagation lets node clicks select and
background clicks deselect, exactly as the selection model requires.

#### 5. Inspector fields are read-only

Decision:

The Inspector shows label, track, artist, position, and color as
read-only text. The "Start Connection" button is not included yet.

Reason:

The MVP decision log already states node rename and color editing are out
of scope, and "Start Connection" belongs to edge creation (Phase 5).

## 2026-06-11: Phase 4 Implementation Decisions

### Context

Phase 4 added the "Add to Canvas" button to the Track Library. Clicking it
creates a new node from a track and places it on the canvas. The scope was
node creation only (no deletion, dragging, or edge creation).

### Decisions

#### 1. Project becomes state in App

Decision:

The whole project is now held in `App` with `useState<Project>(mockProject)`
instead of referencing `mockProject` directly.

Reason:

Adding a node must change `project.nodes` at runtime. Holding the project in
state is the smallest change that makes the data mutable, and it sets up the
later "drag to reposition" step (Phase 4.x), which also writes node x/y back
into the project.

#### 2. Node creation lives in App, library stays presentational

Decision:

`handleAddToCanvas(trackId)` is defined in `App`. `TrackLibrary` only calls
`onAddToCanvas(track.id)` and does not own any project state.

Reason:

`App` owns the project, so the entity that creates nodes belongs there. The
library stays a simple presentational component, consistent with the Phase 3
data flow.

#### 3. Runtime node ids use crypto.randomUUID()

Decision:

New nodes get `id: crypto.randomUUID()`, not the `"node-00N"` format used by
the mock data.

Reason:

This matches the existing comment in `types.ts`/`mockProject.ts`: hand-written
mock entities use readable ids, but runtime-created entities use
`crypto.randomUUID()` to guarantee uniqueness without tracking a counter.

#### 4. Simple fixed offset for placement (no auto-layout)

Decision:

New nodes are placed at `x: 200 + nodes.length * 30`, `y: 200 + nodes.length * 30`.

Reason:

A real auto-layout is out of scope. The fixed offset is just enough to keep
repeated additions from fully overlapping, while staying trivial to read.

#### 5. Default node color for created nodes

Decision:

Created nodes use a single default color (`#64748B`). The source track has no
color of its own.

Reason:

`TrackNode.color` is optional and tracks do not carry a color. A neutral
default keeps the visuals consistent without inventing per-track colors, which
would be a separate feature.

#### 6. Same track may be added multiple times

Decision:

There is no guard against adding the same track to the canvas more than once.

Reason:

Placing the same track at multiple points in a mix is a natural DJ use case,
and the fixed offset keeps duplicates visually distinct.

### Follow-up (not implemented in Phase 4)

* **Node deletion is not implemented in Phase 4.** A node can be created and
  selected but not removed. Deletion is handled separately in Phase 4.5
  ("Delete selected node"), which also removes any edges connected to the
  deleted node.

## 2026-06-11: Phase 4.5 Implementation Decisions

### Context

Phase 4.5 added node deletion, the follow-up flagged at the end of Phase 4.
It is a small, separate phase so the history stays "1 phase = 1 PR" and the
delete logic does not mix into the Add to Canvas change.

### Decisions

#### 1. Delete UI lives in the Inspector Panel

Decision:

The first delete affordance is a "Delete node" button in the Inspector Panel,
shown only when a node is selected.

Reason:

The Inspector already represents "the currently selected node", so it is the
natural home for actions on that node. Showing the button only when a node is
selected keeps the UI honest: there is nothing to delete otherwise.

#### 2. Deleting a node also deletes its connected edges

Decision:

`handleDeleteNode` removes the node from `project.nodes` and also removes any
edge whose `fromNodeId` or `toNodeId` equals the deleted node id.

Reason:

An edge that points at a missing node is invalid data (a dangling edge). There
are no edge-creation features yet, but mock data already contains an edge, and
future phases add more. Cleaning up edges here keeps the project always
consistent and avoids a class of bugs later. The field names `fromNodeId` /
`toNodeId` were taken directly from the `TransitionEdge` type in `types.ts`,
not assumed.

#### 3. Clear the selection after delete

Decision:

After deleting, `selectedNodeId` is set to `null`.

Reason:

The selected node no longer exists, so keeping its id selected would point at
nothing. Clearing the selection returns the Inspector to its "Select a node"
placeholder, which is the correct empty state.

#### 4. No keyboard, no drag-to-trash, no confirm dialog (yet)

Decision:

Delete/Backspace key support, drag-to-trash, and a confirmation dialog are not
included.

Reason:

The goal is the smallest correct delete. A button is enough to prove the data
flow. Keyboard shortcuts and confirmation are UX refinements that can be added
later if they prove necessary; adding them now would widen the scope.

## 2026-06-11: Phase 5 Implementation Decisions

### Context

Phase 5 added node dragging on the canvas. A node can be dragged to a new
position, and its x/y is written back into the project. The scope was dragging
only (no edge creation, import/export, audio, or crossfade).

### Decisions

#### 1. Native mouse events, no drag-and-drop library

Decision:

Use native `mousedown` / `mousemove` / `mouseup` events. Do not add a
drag-and-drop library.

Reason:

The MVP favors readable code and no unnecessary libraries. The interaction is
small enough to implement directly: select on mousedown, update x/y on
mousemove, stop on mouseup. The move/up listeners are attached to `window` so a
fast drag that leaves the node still tracks the pointer.

#### 2. Update the project on every mousemove (option 1)

Decision:

Each `mousemove` calls `onMoveNode`, which immutably replaces the dragged
node's x/y in `project.nodes` via `map`.

Reason:

This keeps a single source of truth (the project) and makes edges follow for
free. With only a handful of nodes, updating state per move is simple and fast
enough. A separate "drag buffer" state would be a premature optimization and
would duplicate the position.

#### 3. mousedown selects the node

Decision:

`mousedown` selects the node before starting the drag.

Reason:

Selecting on mousedown means starting a drag also selects, which matches user
expectation and keeps the Phase 3 selection behavior intact. It also lets the
Inspector show the node being moved.

#### 4. Suppress the click that follows a real drag

Decision:

A `didDrag` ref is set on the first mousemove. The subsequent `click` is
ignored when `didDrag` is true.

Reason:

The browser fires a `click` after `mouseup`. Without this guard, a drag would
also run the click's select logic. Selection already happened on mousedown, so
the trailing click should do nothing after a real drag. A plain click (no
movement) still selects normally.

#### 5. NodeCanvas owns the canvas ref

Decision:

`NodeCanvas` holds the canvas element via `useRef` and passes it to each
`TrackNode`. Nodes convert mouse coordinates to canvas space using
`getBoundingClientRect()` on that ref.

Reason:

Nodes must not query the DOM themselves (e.g. `document.querySelector`). Passing
the ref keeps ownership clear and the components decoupled from the DOM
structure.

#### 6. No coordinate clamping

Decision:

A node can be dragged anywhere, including negative or off-screen coordinates.

Reason:

Clamping to the canvas bounds is out of scope for the MVP. Allowing free
positions keeps the logic minimal; bounds handling can be added later if needed.

#### 7. EdgeView is unchanged

Decision:

`EdgeView` is not modified. Edges follow moved nodes automatically.

Reason:

`EdgeView` already derives its line endpoints from each node's x/y (center of
the fixed-size node). Updating a node's x/y is enough for connected edges to
re-render in the new position.

## 2026-06-21: Phase 6 Implementation Decisions

### Context

Phase 6 implements step 11 of the First Implementation Order: JSON save/load
(export/import). This is original MVP scope (docs/02_mvp_scope.md §6,
docs/07_project_storage.md). A minimal Vitest setup was added alongside it.

### Decisions

#### 1. Pure storage module separated from DOM glue

Decision:

`serializeProject` and `parseProject` are pure functions; `downloadProject`
holds the DOM/blob download. All live in `src/storage/projectStorage.ts`.

Reason:

Keeping serialization/validation pure makes them unit-testable without a DOM
and keeps audio/UI concerns out of storage (matches the architecture rules in
CLAUDE.md).

#### 2. Minimal validation in parseProject

Decision:

`parseProject` checks only that the top-level required fields exist and have
the right shape: `id`/`title` are strings and `tracks`/`nodes`/`edges` are
arrays. Anything else (bad JSON, missing field, wrong type) throws an `Error`.

Reason:

This matches docs/07_project_storage.md ("validate required top-level fields")
and keeps the MVP small. Deep per-field validation is out of scope.

#### 3. Import replaces the project and clears selection

Decision:

A successful import calls `setProject(loaded)` and `setSelectedNodeId(null)`.
On error the current project is unchanged and a `window.alert` shows the
message.

Reason:

The loaded project's nodes differ from the current ones, so the old
`selectedNodeId` would be stale. Clearing it avoids a dangling selection.
`alert` is the smallest reasonable error surface for the MVP.

#### 4. Separate ProjectToolbar component

Decision:

Export/Import controls live in a new `ProjectToolbar.tsx`, not in
`TrackLibrary`. Import uses a hidden file input opened by a visible button.

Reason:

Keeps the Track Library presentational and focused. The hidden-input pattern
gives a normal-looking button while using the native file picker.

#### 5. Vitest for pure-function tests only

Decision:

Added `vitest` as the only new devDependency and a `"test": "vitest run"`
script. Tests cover `projectStorage` pure functions only. No React Testing
Library or end-to-end tests yet.

Reason:

docs/11_development_workflow.md states a Test-First Preference and anticipates
tests once they exist. `projectStorage` is the natural first target: pure, with
side effects isolated in `downloadProject`. Scope was kept minimal per the
request.

## 2026-06-21: Phase 7 Implementation Decisions

### Context

Phase 7 implements step 9 of the First Implementation Order: edge creation via
the "Start Connection" flow described in docs/05_ui_requirements.md. The agreed
edge defaults were recorded earlier in this log; this phase makes them real.

### Decisions

#### 1. Connection mode is a single `connectionSourceId` state

Decision:

`App` holds `connectionSourceId: string | null`. Non-null means connection mode
is active, and its value is the source node id.

Reason:

One nullable field encodes both "are we connecting?" and "from which node?".
This keeps the state minimal and avoids a separate boolean that could drift out
of sync with the source id.

#### 2. Drag is fully suppressed during connection mode

Decision:

While connecting, `TrackNode`'s mousedown returns immediately (after
`stopPropagation`), so no drag starts and no window mouse listeners are added.
The following click then completes the connection.

Reason:

Drag and "click to pick a target" both begin with mousedown on a node. In
connection mode the target click must win, so dragging is disabled outright
rather than disambiguated after the fact.

#### 3. stopPropagation guards the background handler

Decision:

`TrackNode` keeps `stopPropagation` on both mousedown and click. The canvas
background's click handler (`handleBackgroundClick`) only runs for clicks on
empty space.

Reason:

Without this, completing a connection (a node click) would bubble to the canvas
and immediately cancel or deselect. Stopping propagation keeps node clicks and
background clicks cleanly separated.

#### 4. After creating an edge, the source stays selected

Decision:

Creating an edge sets `connectionSourceId` back to null but does not change
`selectedNodeId`, so the source node remains selected.

Reason:

It lets the user start another connection from the same source without
reselecting it, and matches the requested behavior.

#### 5. Self-loops are blocked; duplicates are not

Decision:

Clicking the source node during connection mode cancels instead of creating a
self-edge. No check is made for an already-existing edge between the same pair.

Reason:

A self-loop is almost always a mis-click, so canceling is the safe choice.
Duplicate-edge prevention is extra logic that is out of scope for this minimal
step.

#### 6. Edge selection/editing is out of scope

Decision:

This phase only creates edges. Selecting an edge and editing its
`transitionType` / `fadeDurationSec` / `note` is deferred.

Reason:

Keeps the change small and focused on the connection flow. The edit form is a
separate concern that can follow once creation works.

## 2026-06-21: Phase 7.5 Implementation Decisions

### Context

Phase 7.5 is a small follow-up to Phase 7: let the user select an edge and
delete it, mirroring the node delete added in Phase 4.5. It is intentionally
scoped to selection + delete only, before moving on to audio playback.

### Decisions

#### 1. selectedEdgeId lives in App, alongside selectedNodeId

Decision:

`App` holds both `selectedNodeId` and `selectedEdgeId` as separate nullable
states.

Reason:

`App` is the single source of truth for the project and selection. Adding a
sibling state matches the existing prop-drilling pattern and avoids a larger
refactor of the many `selectedNodeId` usages from Phases 3-7.

#### 2. Exclusivity via selectNode / selectEdge wrappers

Decision:

Two small helpers enforce that node and edge selection are mutually exclusive:
`selectNode` clears the edge, `selectEdge` clears the node.

Reason:

Keeping the "only one selected at a time" invariant in two tiny functions is
simpler and safer than a combined `selection: {type, id}` union, which would
touch every existing `selectedNodeId` reference. The union approach was
considered and deferred as too large for this phase.

#### 3. Wide transparent hit line for clicking edges

Decision:

Each edge renders a visible 2px line plus a separate transparent 12px
`.edge-hit` line with `pointer-events: stroke`. The `.edge-layer` SVG stays
`pointer-events: none` and the visible line is also `pointer-events: none`.

Reason:

The SVG layer sits behind the nodes; leaving it `pointer-events: none` keeps
node clicks working. A thin 2px line is hard to click, so a wider invisible
stroke provides a comfortable hit target. `pointer-events: stroke` limits the
hit area to the line itself, not its bounding box.

#### 4. Edge click stops propagation

Decision:

The hit line's click handler calls `event.stopPropagation()` before selecting.

Reason:

Without it, the click would bubble to the canvas background and immediately
clear the selection (or, in connection mode, cancel). This mirrors the node
click handling from Phases 3 and 7.

#### 5. Edge clicks are ignored during connection mode

Decision:

`handleEdgeClick` returns immediately when `connectionSourceId` is set, so
clicking an edge during connection mode does nothing. The hit line still stops
propagation, so the background cancel does not misfire.

Reason:

This keeps the Phase 7 connection flow intact and is the agreed minimal
behavior: an edge click mid-connection is a no-op rather than a surprise.

#### 6. Import clears all selection-related state

Decision:

A successful JSON import clears `selectedNodeId`, `selectedEdgeId`, and
`connectionSourceId`.

Reason:

The loaded project has its own ids; any retained selection or connection source
would point at the old project. Clearing all three avoids dangling references.

#### 7. Edge editing stays out of scope

Decision:

The Inspector shows edge info read-only (from -> to, transitionType,
fadeDurationSec). Editing `transitionType` / `fadeDurationSec` / `note` is not
implemented, even though docs/05_ui_requirements.md describes an edit form.

Reason:

This phase is deliberately limited to selection + delete. The edit form is a
separate concern for a later phase; the deviation from the UI doc is
intentional and recorded here.

## 2026-06-21: Phase 8 Implementation Decisions

### Context

Phase 8 implements step 12 (simple audio playback). The goal is to introduce
the Web Audio API structure with a minimal, audible result, not to manage audio
files. Per docs/06_audio_engine_requirements.md, audio logic is isolated from
the UI.

### Decisions

#### 1. Oscillator as a placeholder source (not AudioBuffer yet)

Decision:

The engine plays an `OscillatorNode` for each node instead of decoding
`node.audioUrl` into an `AudioBuffer`. Each node gets a stable frequency and
waveform derived from its id.

Reason:

This produces sound immediately with no audio files, no decoding, and no
copyright/size concerns, so the focus stays on the Web Audio API structure
(context, source, gain, destination, cleanup). Real audio is a later phase.

#### 2. Single swap point: createSourceForNode

Decision:

All source creation goes through the private `createSourceForNode(context,
node)`. Today it returns an oscillator. The rest of the engine (wiring, gain
envelope, start/stop, cleanup) does not depend on the source type.

Reason:

When real audio (e.g. Suno mp3) is added, only this one method changes: build
an `AudioBufferSourceNode` from `node.audioUrl` when present, and fall back to
the oscillator otherwise. The UI and domain types stay untouched. This is the
recorded migration path from the oscillator placeholder to `audioUrl`-based
`AudioBufferSourceNode` playback.

#### 3. High-level engine API; UI knows nothing about audio internals

Decision:

The engine exposes `playNode(node)`, `stop()`, `dispose()`. `PlayerControls`
only invokes `onPlay` / `onStop` callbacks wired by `App`; it does not import
or hold the engine, and never references oscillators/frequencies/waveforms.

Reason:

Keeps audio logic out of React components (a requirement) and makes the future
source swap invisible to the UI.

#### 4. Lazy engine instance and lazy AudioContext

Decision:

`App` holds `useRef<AudioEngine | null>(null)` and constructs the engine on
first access. The engine constructor does not open an `AudioContext`; the
context is created on the first `playNode` call, which happens from a user
gesture, and is reused afterward.

Reason:

Two levels of laziness: avoid building the engine before it is needed, and
avoid opening an AudioContext before a user gesture (browser autoplay policy).
Reusing one context avoids overlapping AudioContexts.

#### 5. dispose() on unmount

Decision:

A `useEffect` cleanup calls `audioEngine.dispose()` (stop + close context) when
the app unmounts.

Reason:

Releases audio resources explicitly instead of leaking a context, matching the
"clean up" quality requirement.

#### 6. One voice at a time; short gain envelope

Decision:

Starting playback stops any current sound first (single voice). Start and stop
use short gain ramps (attack/release) and old nodes are disconnected after the
release.

Reason:

The MVP plays one node at a time; the ramps avoid clicks, and disconnecting old
sources prevents them from piling up.

#### 7. Pure sound mapping split out for testing

Decision:

The node -> frequency/waveform mapping lives in `src/audio/nodeSound.ts` as
pure functions, separate from the Web Audio code, and is unit tested.

Reason:

The Web Audio API is hard to test under jsdom, but the musical mapping is a
pure function and easy to test, matching the project's test-first preference.

## 2026-06-21: Phase 9 Implementation Decisions

### Context

Phase 9 implements step 13 (crossfade), the final MVP step. It extends the
Phase 8 oscillator engine to play a transition between a selected edge's source
and target nodes, using `transitionType` and `fadeDurationSec`.

### Decisions

#### 1. Transition is a preview, not full DJ playback

Decision:

The oscillator-based transition plays the edge's source node and target node as
a preview. It does not transition from whatever track is currently playing.

Reason:

Real DJ behavior (transitioning out of the actually-playing track) requires real
audio sources and richer state. For the MVP it is enough to demonstrate the
cut/fade/crossfade shapes between a source and a target. When real audio (mp3 /
Suno) is added later, this is extended into actual track playback.

#### 2. Single currentVoice -> activeVoices array

Decision:

The engine tracks `activeVoices: Voice[]` instead of one `currentVoice`.

Reason:

A crossfade plays two voices at the same time (source fading out, target fading
in). A list lets the engine schedule, track, and clean up any number of voices,
and `stop()` simply tears down all of them.

#### 3. cut / fade / crossfade interpretation

Decision:

- cut: play only the target immediately (tiny fade-in to avoid a click).
- fade: fade the source out over `fade`, then start the target.
- crossfade: play both, source 1->0 and target 0->1 over `fade`.

Reason:

These match docs/06_audio_engine_requirements.md and are the smallest faithful
implementations of each shape on top of the existing source->gain->destination
wiring.

#### 4. Abnormal fadeDurationSec rounds to 0.01s

Decision:

`sanitizeFadeDuration` clamps any non-finite value, or any value <= 0.01, to
0.01s (an almost-instant transition), and caps values above 60s.

Reason:

Imported or hand-edited projects may contain 0, negative, NaN, or Infinity.
Rounding to a tiny fade keeps the transition almost immediate and easy to debug,
rather than silently substituting an unrelated "natural" duration like 3s. The
clamp is a pure function, so it is unit tested.

#### 5. New play cancels the previous; Stop is always available

Decision:

Every `playNode` / `playTransition` calls `stop()` first. In the UI, Stop stays
enabled even when nothing is selected.

Reason:

Only one preview should sound at a time, so a new play cancels the previous.
Selection state and playback state are independent, so the user must be able to
stop a running sound regardless of what (if anything) is selected.

#### 6. PlayerControls owns the trigger; Inspector is unchanged

Decision:

The "Play transition" control lives in PlayerControls, which switches on whether
a node or an edge is selected. InspectorPanel keeps showing edge info and the
Delete connection button only.

Reason:

Keeps playback controls in one place (easy to extend) and avoids mixing
playback into the Inspector, which is for inspecting and deleting.

---

## 2026-07-10: Audio Architecture Direction (Player / Analyzer Split)

### Context

A revised project policy ("DJ Node Mix 方針書", written with Grok) proposed
making the whole `AudioEngine` swappable, with a future `CppAudioEngine`
(C++/WASM) replacing the JS `WebAudioEngine`. This was discussed with Claude
and corrected. Full discussion record:
`docs/discussions/2026-07-10_claude_audioengine_ts_dsp-poems.md`.

These decisions refine the future direction only. The implemented MVP audio
engine (Phases 8–9) is unaffected.

### Decisions

#### 1. The swap unit is the Analyzer, not the whole engine

Decision:

Split the audio layer into Player (playback: load / play / stop / crossfade)
and Analyzer (analysis: BPM, beats, waveform peaks). Only the Analyzer is a
replacement target. The Player stays JS + Web Audio permanently. The existing
`AudioEngine` class is the Player.

Reason:

In a browser, audio output always goes through Web Audio. WASM cannot output
sound directly, so a C++ rewrite of playback would still drive Web Audio from
JS and gain nothing. Analysis is a pure function over PCM data, which is
exactly what WASM is good at.

#### 2. Analyzer boundary rules (data types over class design)

Decision:

The future Analyzer interface must be: async only, no Web Audio types
(`Float32Array` + `sampleRate` instead of `AudioBuffer`), plain serializable
results only, and decoding fixed on the JS side (`decodeAudioData`).

Reason:

Portability to Workers/WASM is determined by what crosses the boundary.
`AudioBuffer` cannot cross a Worker boundary and does not exist in C++.
Details in `docs/06_audio_engine_requirements.md` ("Future Direction").

#### 3. Analysis features are introduced library-first

Decision:

When analysis is needed, adopt in stages behind the Analyzer interface:
simple JS library (e.g. web-audio-beat-detector) → high-accuracy WASM library
(e.g. essentia.js) → optionally hand-written C++/WASM.

Reason:

Mature analysis libraries already exist, and the best ones (essentia.js,
aubiojs) are themselves C++/WASM. A hand-written C++ port is therefore a
learning exercise, not a performance requirement. Check maintenance status
before adopting any library.

#### 4. TypeScript is confirmed (policy doc's "JavaScript" is superseded)

Decision:

The entire JS-side codebase stays TypeScript, as it already is. The policy
doc's Phase 1 "React + JavaScript" wording is superseded.

Reason:

The swap strategy depends on implementations honoring a shared contract
(`implements Analyzer`). Plain JS has no `interface` construct, so the
contract would be unchecked convention. TS compiles to the same JS at runtime.

#### 5. MVP requires no analysis

Decision:

No Analyzer is implemented or designed in detail until a concrete feature
(waveform display, BPM display) needs it.

Reason:

The MVP goal (connect nodes, play transitions) is already implemented without
any analysis. Designing an interface for an unimplemented C++ future risks
over-abstraction (YAGNI).

---

## 2026-07-12: MVP Completion Criteria and Phase 10 (Edge Editing)

### Context

With Phases 0-9 implemented, the question was whether to declare the MVP
complete. The Definition of Done includes "A user can define a simple
transition", but the Inspector showed a selected edge's `transitionType` and
`fadeDurationSec` read-only: every new edge was fixed at crossfade / 3s, and
trying `cut` or `fade` required hand-editing the exported JSON. Discussion
record: `docs/discussions/2026-07-12_mvp_completion_phase10.md`.

### Decisions

#### 1. "Define a simple transition" requires editing, not just creating

Decision:

Interpret the DoD item as "the user can choose the transition type and fade
duration from the UI". The MVP is therefore not complete until edge editing
exists. Phase 10 (edge editing) is added as the final MVP phase.

Reason:

Two readings were possible: (A) creating an edge with defaults already counts
as "defining", or (B) defining implies choosing. (B) was chosen because an MVP
where two of the three transition types are unreachable without hand-editing
JSON does not demonstrate the product concept, and the editing UI was already
specified in `docs/05_ui_requirements.md` ("Edge Selected").

#### 2. Phase 10 scope: type select + fade input only

Decision:

The Inspector's edge view gets a `transitionType` select (cut / fade /
crossfade) and a `fadeDurationSec` number input. Editing `note` stays out of
scope even though `docs/05_ui_requirements.md` lists it as optional.

Reason:

The smallest change that satisfies the DoD interpretation above. `note` has no
effect on playback and can come later.

#### 3. Editing rules live in a pure domain module

Decision:

The consistency rules are implemented as pure functions in
`src/domain/edgeRules.ts` (unit tested), not inside the React components:

- Switching to `cut` sets `fadeDurationSec` to 0; the fade input is disabled
  while the type is `cut`.
- Switching to `fade` / `crossfade` when the fade is 0 resets it to the
  default (3, exported as `DEFAULT_FADE_SECONDS` and reused for new edges).
- Non-finite input (an emptied number field parses to NaN) and negative
  values clamp to 0.

Reason:

Matches the project rule "separate domain logic from UI logic" and the
existing pattern (`transitionTiming.ts`, `nodeSound.ts`). The rules were
already agreed in the Phase 7 planning entry ("Rules for fadeDurationSec");
Phase 10 implements them.

---

## 2026-07-12: MVP Declared Complete

### Context

Phase 10 (edge editing) was merged as PR #16, closing the last gap identified
in the MVP completion discussion (see the previous entry and
`docs/discussions/2026-07-12_mvp_completion_phase10.md`).

### Decision

The MVP defined in `CLAUDE.md` ("Definition of Done for MVP") and
`docs/02_mvp_scope.md` is declared complete as of 2026-07-12.

How each Definition of Done item is met:

| DoD item | Met by |
|---|---|
| A user can see tracks in a library | Phase 2 (Track Library) |
| A user can see tracks as nodes on a canvas | Phases 2, 4 (render + Add to Canvas) |
| A user can connect nodes | Phase 7 (Start Connection flow) |
| A user can define a simple transition | Phases 7 + 10 (create edge, then edit type / fade) |
| A user can play a basic transition | Phases 8, 9 (playback, cut / fade / crossfade) |
| A user can save and load the project as JSON | Phase 6 (export / import) |
| The code structure is understandable | domain / audio / components / storage split; ~1,700 lines; 23 unit tests |

### Notes and known limitations (accepted for the MVP)

- Playback uses an oscillator placeholder; `audioUrl` is not loaded. Real
  audio file import is the next phase (design questions recorded in the
  2026-07-12 discussion record, section 5).
- Editing `note` on an edge, drag-and-drop from the library, and node
  renaming remain deferred as planned.
- No analysis exists; the BPM shown in the Track Library is mock metadata.

### Next

Post-MVP work starts with the audio file import phase: file selection and
persistence strategy, decode via `decodeAudioData`, and the first real
`Player` use of PCM — the point where the Player / Analyzer boundary
(2026-07-10 entry) becomes concrete.

---

## 2026-07-26: Phase 11 Implementation Decisions (Audio File Import)

### Context

Phase 11 is the first post-MVP phase: real audio playback from a locally
picked MP3/WAV file, replacing the oscillator placeholder for tracks that
have a file loaded. It resolves the design questions carried over from the
MVP completion discussion (2026-07-12 record, section 5) and is the phase
where the Player / Analyzer boundary (2026-07-10 entry) first became
concrete. The approved plan is `docs/plans/phase11_audio_file_import.md`.

### Decisions

#### 1. Persistence: in-memory only

Decision:

A picked file is decoded and held in memory. Nothing audio-related is
saved to the project JSON (not even the file name), and audio is gone
after a reload.

Reason:

Object URLs die on reload, so "just save the URL" cannot work. IndexedDB
or the File System Access API would pull the phase's focus away from
decoding and playback. Persistent audio storage is a future phase that
slots in behind the same store interface. Re-linking files by name is a
future convenience deliberately left out.

#### 2. Decode once, at import time

Decision:

File pick -> `file.arrayBuffer()` -> `decodeAudioData` -> the decoded
`AudioBuffer` is kept. Playback never decodes. The file pick is a user
gesture, so the engine's lazy `AudioContext` may be created there.

#### 3. Decoded PCM lives in a dedicated store (TrackAudioStore)

Decision:

New module `src/audio/trackAudioStore.ts` maps `trackId -> AudioBuffer`.
App owns the store and passes it to the `AudioEngine`. The Player side
reads `AudioBuffer`s; the future Analyzer side gets plain
`{ samples: Float32Array, sampleRate }` via `pcmFor()`.

Reason:

Decoded PCM is shared data (Player today, Analyzer later), so neither
side should own it. `pcmFor()` enforces the 2026-07-10 rule that Web
Audio types never cross the Analyzer boundary.

#### 4. The swap point worked as recorded

Decision (confirmation):

Only `createSourceForNode` changed for playback: it returns an
`AudioBufferSourceNode` when the node's track has audio in the store,
and the oscillator otherwise. The gain-envelope / transition logic is
untouched, as promised by the Phase 8 entry ("Single swap point").

#### 5. Analysis result storage stays undecided

Decision:

Question 3 from the 2026-07-12 list (where `AnalysisResult` lives) is
deferred until an Analyzer implementation exists. `AnalysisResult`
remains restricted to serializable data.

### Accepted trade-offs

- Real audio plays at the same fixed gain as the oscillator (0.2), so
  imported tracks sound quiet; loudness tuning is future work.
- Playback always starts at the beginning of the file; no seeking or
  per-node offsets.
- Re-importing a file for a track replaces its buffer silently.

### Verification

27 unit tests pass (4 new for `TrackAudioStore`). Browser-driven check
with a generated 2-second WAV: load -> indicator, node playback,
crossfade transition playback, and a rejected non-audio file (alert, no
state change), all with no console errors. Audible confirmation was done
by the developer.
