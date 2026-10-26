# UI Requirements

## Layout Overview

The application uses a two-column layout:

```
+-------------------+-------------------------------+
|                   |                               |
|  Track Library    |        Node Canvas            |
|  (left panel,     |        (main area)            |
|   top half)       |                               |
|                   |                               |
+-------------------+                               |
|                   |                               |
|  Inspector        +-------------------------------+
|  Panel            |     Player Controls           |
|  (left panel,     |     (bottom bar)              |
|   bottom half)    |                               |
+-------------------+-------------------------------+
```

Left column: Track Library (top) and Inspector Panel (bottom).
Right column: Node Canvas (main area) with Player Controls pinned to the bottom.

## Track Library

The Track Library shows all tracks in `Project.tracks`.

`Project.tracks` is the track library for the MVP. There is no separate global library.

Each track entry shows:
- track title
- artist (if available)
- BPM (if available)
- an "Add to Canvas" button

### Add to Canvas

Clicking "Add to Canvas" creates a new `TrackNode` for that track and places it on the canvas.

- The node label is initialized from `Track.title`.
- The node color is assigned automatically.
- The node is placed using this deterministic formula, where `nodeCount` is the number of nodes currently on the canvas before the new one is added:

  ```ts
  x = 120 + (nodeCount % 5) * 80;
  y = 120 + Math.floor(nodeCount / 5) * 80;
  ```

  This produces a simple grid-like arrangement starting at (120, 120) and stepping right by 80px, wrapping to the next row every 5 nodes.

- Do not implement zoom-aware placement, center-of-canvas placement, or advanced auto-layout in the MVP.

Drag-and-drop from library to canvas is not implemented in the MVP.

## Node Canvas

The canvas is a free-form 2D area.

Node positions use CSS pixel coordinates relative to the top-left corner of the canvas.

### Node Display

Each node renders as a visible card or rectangle showing:
- label (initialized from `Track.title`)
- artist (if available from the linked `Track`)
- a visual selected state when the node is selected

### Node Interaction

Clicking a node selects it and deselects any previously selected edge.

Clicking an empty area on the canvas deselects the current selection.

A selected node can be dragged to reposition it on the canvas.
Dragging updates the node's `x` and `y` values.

### Edge Display

Each edge is rendered as a line or arrow between two nodes.

The line should indicate direction (from → to), for example using an arrowhead.

Clicking an edge selects it and deselects any previously selected node.

### Canvas Interaction State

The canvas has two modes:

- **Normal mode**: click to select nodes and edges, drag to reposition selected nodes.
- **Connection mode**: active after the user starts an edge creation operation. Clicking a target node completes the connection. Clicking empty space cancels.

## Edge Creation

Edge creation uses a two-step click interaction:

1. Select a source node by clicking it.
2. Click "Start Connection" in the Inspector Panel.
3. The canvas enters connection mode. A visual indicator shows that connection mode is active.
4. Click a target node to create a directed edge from source to target.
5. The new edge is created with these default values:
   - `transitionType: "crossfade"`
   - `fadeDurationSec: 3`
   - `note: undefined`
6. The canvas returns to normal mode.

Clicking empty canvas space during connection mode cancels the operation without creating an edge.

Drag-to-connect is not implemented in the MVP.

## Inspector Panel

The Inspector Panel shows properties of the currently selected item.

### Node Selected

When a node is selected, show:
- node label (read-only in MVP)
- linked track title and artist
- node position `x`, `y` (read-only in MVP)
- node color (read-only in MVP)
- "Start Connection" button to begin edge creation from this node

### Edge Selected

When an edge is selected, show:
- from node label → to node label
- `transitionType` selector: `cut`, `fade`, `crossfade`
- `fadeDurationSec` number input
- `note` text input (optional)

When the user changes `transitionType` to `cut`, `fadeDurationSec` should be automatically set to `0`.
When the user changes `transitionType` to `fade` or `crossfade` and `fadeDurationSec` is `0`, it should be automatically reset to `3`.

Phase 20 adds two number inputs, "Exit at" (`exitAtSec`) and "Enter at" (`enterAtSec`), in seconds. An empty field means the default (shown as a placeholder); clearing a field returns to it. Values are clamped into the track they refer to.

## Deck Panel (Phase 16–20)

A strip along the bottom shows two decks, NOW and NEXT, each with its track's waveform, position, and BPM.

Which nodes the decks show:

- With an edge selected: NOW is the edge's from-node and NEXT is its to-node, and each waveform shows the transition window (a marker where it opens and a shaded span for its length).
- Otherwise: NOW is the node playing, or the selected node when nothing plays; NEXT is where playback would go from there along the first outgoing edge. What NEXT should show when a node has several outgoing edges is still an open question.

What a click on a waveform does:

- With an edge selected: a click on NOW sets the edge's `exitAtSec`; a click on NEXT sets its `enterAtSec`.
- Otherwise: a click seeks to that point of the track (Phase 17).

"Play transition" on a selected edge starts the from-track five seconds before its exit point, hands over there, and brings the to-track in at its enter point, so the transition can be heard without waiting for the track to end.

### Nothing Selected

When no node or edge is selected, show a placeholder message such as "Select a node or edge".

## Player Controls

The Player Controls bar is pinned to the bottom of the canvas area and is always visible.

It contains:
- **Play Track** button — enabled only when a node is selected
- **Play Transition** button — enabled only when an edge is selected
- **Stop** button — always enabled

"Play Track" plays the audio for the selected node's linked track.

"Play Transition" plays the transition defined by the selected edge, including any fade or crossfade behavior.

If a node has multiple outgoing edges, the app does not choose automatically. The user must select a specific edge to trigger its transition.

## Selection Model

At any moment, the selection state is one of:
- nothing selected
- one node selected
- one edge selected

Selecting a node clears any selected edge. Selecting an edge clears any selected node.

## Responsive Design

The MVP targets desktop browsers at a minimum width of approximately 1024px.

Mobile layout is out of scope for the MVP.
