# Phase 15 Plan: Adding and Removing Tracks

- Date: 2026-08-17
- Status: approved (discussed with Claude, 2026-08-17)
- Inputs: `docs/10_decision_log.md` (2026-08-17 Phase 14 entry, "Known gap:
  no way to add a track"), `docs/plans/phase14_local_server_persistence.md`

## Goal

Build a set out of your own music: put files in `audio/`, add the ones you
want as tracks, and drop them on the canvas. Remove a track you added by
mistake.

## The problem this fixes

The Track Library lists `project.tracks`, and the only tracks that have
ever existed are the two from `mockProject`. Phase 14 let a track's audio
come from the `audio/` folder, but adding a third file to that folder
changes nothing visible: it only becomes another option in the two existing
tracks' pickers. However many songs are in the folder, only two can be used
at a time.

This was invisible while the app ran on mock data and surfaced the moment
real music was used.

## Decisions

1. **Tracks are added explicitly**, by choosing a file from `audio/`. The
   library stays "the songs chosen for this project", not a mirror of a
   folder. Auto-listing the folder was rejected: tracks are project data
   that nodes reference by id, so a deleted file would leave nodes pointing
   at a track that vanished, and there would be no way to work with a
   subset of the folder.
2. **A track can be removed**, so a mistaken add is recoverable. Removal is
   blocked while any node uses the track, which keeps the guarantee that a
   node's `trackId` always resolves.
3. **The mock tracks stay** as the first-run content when no project has
   been saved. They can now be removed like any other track, so they are no
   longer permanent.
4. **The title comes from the file name** without its extension
   (`Midnight Piano Drift.mp3` -> `Midnight Piano Drift`). Artist and BPM
   are left empty: they are not knowable from a file name, and BPM is where
   a future Analyzer writes.
5. **Files already used by a track are not offered again.** A song appears
   twice in a set as two nodes of one track, not as two tracks, so a
   duplicate library entry would be a mistake rather than a use case.

## Scope

1. `src/domain/trackRules.ts` (+ test) — pure:
   - `trackTitleFromFileName(fileName)`: strip the extension, keep the rest.
   - `isTrackInUse(nodes, trackId)`: whether any node references the track.
2. `src/components/TrackLibrary.tsx`:
   - an "Add track from audio" picker listing the server files not already
     attached to a track; choosing one adds the track.
   - a "Remove" button per track, disabled while the track is in use.
3. `src/App.tsx`: create the track (id via `crypto.randomUUID`, title from
   the file name, `audioUrl` set) and load its audio immediately so it can
   be played straight away; remove a track.
4. `src/index.css`: styles for the two new controls.

## Out of scope

- Editing a track's title, artist or BPM after adding it (the file name is
  the title; renaming is a separate, larger interaction).
- Adding tracks without the server running (there are no server files to
  choose from; the offline session-only picker still attaches audio to
  existing tracks).
- Deleting the underlying file from `audio/` — removing a track never
  touches the folder.
- Cascading removal (deleting a track together with the nodes that use it):
  the button is blocked instead, so nothing disappears unexpectedly.

## File changes

| File | Change |
|---|---|
| `src/domain/trackRules.ts` (+ test) | new: title from file name, in-use check |
| `src/components/TrackLibrary.tsx` | add picker + per-track Remove button |
| `src/App.tsx` | add/remove track handlers |
| `src/index.css` | styles for the new controls |

## Trade-offs accepted

- A track added from a file whose name is unhelpful (`track01.mp3`) gets an
  unhelpful title, and there is no way to rename it yet.
- Removal is blocked rather than cascading, so clearing a track that is on
  the canvas takes two steps (delete the nodes, then the track).
- Adding is only possible with the server running.

## Testing

- Unit: `trackTitleFromFileName` (normal name, several dots, no extension,
  empty), `isTrackInUse` (unused, used, other tracks' nodes).
- Browser (verify skill): add a track from a file in `audio/`, confirm it
  appears with the file name as its title, place it on the canvas and play
  it; confirm its file is no longer offered in the add picker; confirm
  Remove is disabled while it is on the canvas and works after the node is
  deleted; save and reload and confirm the added track is still there.
