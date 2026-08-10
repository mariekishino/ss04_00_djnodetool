# Phase 12 Plan: Sequential Playback

- Date: 2026-07-26
- Status: approved (discussed with Claude, 2026-07-26)
- Inputs: `docs/plans/phase11_audio_file_import.md`, `docs/10_decision_log.md`
  (2026-07-26 Phase 11 entry), `docs/06_audio_engine_requirements.md`

## Goal

Play a node's track all the way through, then follow its outgoing edge and
transition into the next track using that edge's settings, repeating along
the graph. This is the first playback that actually walks the node graph;
everything before it played a single node or a short transition preview.

Phase 11 made this possible: real audio means a track finally has a
natural length to play to.

## What exists today (and stays)

- `Play` — plays the selected node alone, from the start, until Stop.
- `Play transition` — previews one edge: both tracks from their start,
  overlapping per the edge's type and fade.

Both remain unchanged. Sequential playback is a third, separate mode.

## Decisions

1. **A new "Play from here" button** starts sequential playback from the
   selected node. `Play` keeps its current meaning (single node), which
   stays useful for checking an imported file.
2. **Branching: follow the first outgoing edge** in `project.edges` order.
   Random or user-chosen routing is a future extension.
3. **Cycles keep playing** until Stop. A `MAX_SEQUENCE_STEPS` (100) guard
   exists only to stop a runaway chain, not as a product feature.
4. **Placeholder nodes get a fixed length.** A track with no imported
   audio plays its oscillator for `PLACEHOLDER_NODE_SECONDS` (5) and then
   transitions, since an oscillator has no natural end.
5. **Step-by-step scheduling.** Each step schedules the next one with a
   timer instead of pre-scheduling the whole chain. Stopping and reasoning
   about state stay simple; the few milliseconds of timer jitter are
   inaudible.
6. **The graph is snapshotted at start.** Editing nodes/edges while a
   sequence plays does not change the running sequence. Restart to pick up
   edits.

## Transition timing

For a track of length `D` with an edge whose sanitized fade is `f`, the
next step is triggered at an offset from the current track's start:

| Type | Trigger offset | Result |
|---|---|---|
| `cut` | `D` | next track starts exactly when this one ends |
| `fade` | `max(0, D - f)` | this track fades out over its last `f`, next starts at `D` |
| `crossfade` | `max(0, D - f)` | both overlap for the last `f`; this one ends at `D` |

A fade longer than the track clamps the offset to 0 (transition starts
immediately), so short tracks cannot produce negative times.

## Scope

1. `src/domain/playbackSequence.ts` — pure `findNextEdge(edges, fromNodeId)`
   returning the first outgoing edge or null.
2. `src/audio/transitionTiming.ts` — add pure
   `transitionTriggerOffset(durationSec, transitionType, fadeSec)` and
   `PLACEHOLDER_NODE_SECONDS`.
3. `src/audio/audioEngine.ts` — two new primitives that do NOT stop
   everything first (unlike `playNode` / `playTransition`):
   - `startNode(node): { durationSec }` — start one voice at full gain.
   - `transitionToNode(edge, targetNode): { durationSec }` — fade the
     currently playing voices out per the edge and bring the target in.
4. `src/audio/sequencePlayer.ts` — owns the walk: current step, the timer,
   the step counter, and an `onNowPlaying(nodeId | null)` callback. It
   calls the engine; it never touches Web Audio or React directly.
5. UI:
   - `PlayerControls` gains a "Play from here" button (node selected).
   - The node currently playing is highlighted on the canvas
     (`playingNodeId` prop -> `.track-node.playing`).
   - Status text shows the playing node while a sequence runs.
6. `Stop` stops the sequence (cancelling its timer) as well as the audio.

## Out of scope

- Choosing among several outgoing edges (random / prompt / weights).
- Pause / resume, seeking, or starting mid-track.
- Reacting to graph edits while playing.
- Per-track volume (imported audio is still quiet — separate phase).
- Saving playback state to the project JSON.

## File changes

| File | Change |
|---|---|
| `src/domain/playbackSequence.ts` (+ test) | new: pick the next edge |
| `src/audio/transitionTiming.ts` (+ test) | new pure trigger-offset rule |
| `src/audio/audioEngine.ts` | `startNode`, `transitionToNode`, voice fade-out helper |
| `src/audio/sequencePlayer.ts` | new: the step-by-step walker |
| `src/components/PlayerControls.tsx` | "Play from here" button, sequence status |
| `src/components/NodeCanvas.tsx`, `TrackNode.tsx` | `playingNodeId` highlight |
| `src/App.tsx` | own the SequencePlayer, `nowPlayingNodeId` state, wire Stop |
| `src/index.css` | `.track-node.playing` style |

## Trade-offs accepted

- Timer-driven steps drift by a few milliseconds versus sample-accurate
  scheduling. Acceptable for a preview-grade player.
- A sequence started before an edit keeps the old route (see decision 6).
- Placeholder nodes all last 5 seconds regardless of their track metadata.

## Testing

- Unit: `findNextEdge` (no edge / one edge / first of several / ignores
  incoming edges), `transitionTriggerOffset` (each type, fade longer than
  track, invalid duration).
- Browser (verify skill): build a 3-node chain with a short generated WAV,
  press "Play from here", confirm the highlight moves node to node on
  schedule and Stop halts it, with no console errors. Audible checks are
  the developer's.
