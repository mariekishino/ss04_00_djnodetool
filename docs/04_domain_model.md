# Domain Model

## Overview

The core domain is a graph-based music arrangement.

The main entities are:

- Track
- TrackNode
- TransitionEdge
- Project

The distinction between Track and TrackNode is important.

A Track is music data.

A TrackNode is the visual placement of that track on the canvas.

A TransitionEdge defines how playback or meaning moves from one node to another.

## Track

A Track represents an audio item.

It contains metadata about the music itself.

```ts
export type Track = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string;
  durationSec?: number;
  audioUrl?: string;
  tags: string[];
};
```

### Notes

- `id` must be stable and unique.
- `title` is required.
- `artist` is optional because generated or local files may not have artist metadata.
- `bpm` is optional because automatic BPM detection is not part of the MVP.
- `key` is optional.
- `durationSec` is optional.
- `audioUrl` may point to a local object URL, sample file, or mock source.
- `tags` can represent genre, mood, memory, or user-defined categories.

## TrackNode

A TrackNode represents a track placed on the canvas.

```ts
export type TrackNode = {
  id: string;
  trackId: string;
  x: number;
  y: number;
  label: string;
  color?: string;
};
```

### Notes

- `id` identifies the node, not the track.
- `trackId` links the node to a Track.
- `x` and `y` are CSS pixel coordinates relative to the top-left corner of the canvas.
- `label` is what the user sees on the node. In the MVP, it is initialized from `Track.title`. Node renaming is not implemented in the MVP.
- `color` is assigned automatically in the MVP. User-defined color editing is not implemented in the MVP.

## TransitionEdge

A TransitionEdge connects two TrackNodes.

It represents a transition or relationship from one node to another.

```ts
export type TransitionType = "cut" | "fade" | "crossfade";

export type TransitionEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transitionType: TransitionType;
  fadeDurationSec: number;
  note?: string;
  exitAtSec?: number;   // Phase 20
  enterAtSec?: number;  // Phase 20
};
```

### Notes

- `fromNodeId` is the starting node.
- `toNodeId` is the destination node.
- `transitionType` defines how the transition should behave.
- `fadeDurationSec` is required. For `cut`, use `0` by convention. For `fade` and `crossfade`, use a positive number.
- `note` can describe why the user connected the tracks.
- `exitAtSec` (Phase 20) is where in the from-track the transition window opens, in seconds. Unset means one fade before the end (the end itself for `cut`).
- `enterAtSec` (Phase 20) is where in the to-track playback comes in, in seconds. Unset means the start.
- Both positions are optional so that project JSON written before Phase 20 loads and plays unchanged. They are kept to 10 ms and clamped into their track when edited and when played.

Examples of notes:

- "same summer feeling"
- "tempo contrast"
- "late night transition"
- "nostalgic mood"
- "good after chorus"

## Project

A Project contains the full music graph.

```ts
export type Project = {
  id: string;
  title: string;
  tracks: Track[];
  nodes: TrackNode[];
  edges: TransitionEdge[];
  createdAt?: string;
  updatedAt?: string;
};
```

### Notes

- The project should be serializable as JSON.
- The project should not depend on React-specific state.
- The project data should be clean enough to export, import, and inspect manually.

## Graph Meaning

The app should treat the arrangement as a directed graph.

```txt
TrackNode A --> TransitionEdge --> TrackNode B
```

For the MVP, edges can be directional.

This means an edge from A to B does not automatically mean there is an edge from B to A.

## Example Project

```ts
export const mockProject: Project = {
  id: "project-001",
  title: "Late Night Prototype Mix",
  tracks: [
    {
      id: "track-001",
      title: "Night Drive",
      artist: "Sample Artist",
      bpm: 110,
      durationSec: 180,
      audioUrl: "/audio/night-drive.mp3",
      tags: ["night", "drive", "smooth"]
    },
    {
      id: "track-002",
      title: "Blue Memory",
      artist: "Sample Artist",
      bpm: 112,
      durationSec: 200,
      audioUrl: "/audio/blue-memory.mp3",
      tags: ["nostalgia", "blue", "soft"]
    }
  ],
  nodes: [
    {
      id: "node-001",
      trackId: "track-001",
      x: 100,
      y: 160,
      label: "Night Drive",
      color: "#3B82F6"
    },
    {
      id: "node-002",
      trackId: "track-002",
      x: 360,
      y: 220,
      label: "Blue Memory",
      color: "#6366F1"
    }
  ],
  edges: [
    {
      id: "edge-001",
      fromNodeId: "node-001",
      toNodeId: "node-002",
      transitionType: "crossfade",
      fadeDurationSec: 5,
      note: "smooth late-night transition"
    }
  ]
};
```

## ID Generation

IDs in mock data use human-readable strings such as `"track-001"`.

IDs created at runtime use `crypto.randomUUID()`.

## Design Rules

- Keep domain types independent from UI libraries.
- Do not mix React component state into the domain model.
- Do not store computed UI-only values in the project unless necessary.
- Do not add backend-specific fields in the MVP.
- Keep the model easy to inspect as JSON.

## Future Extensions

Possible future fields:

```ts
mood?: string[];
energy?: number;
waveformUrl?: string;
analysis?: {
  bpm?: number;
  key?: string;
  loudness?: number;
};
aiPrompt?: string;
imagePrompt?: string;
```

These should not be added until the MVP is stable.