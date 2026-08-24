# Phase 18 Plan: One Way In — Streamlining the Track Library

- Date: 2026-08-24
- Status: proposed (direction agreed in the 2026-08-24 discussion; details await review)
- Inputs: `docs/discussions/2026-08-17_open_issue_track_audio_identity.md`,
  `docs/discussions/2026-08-17_feedback_after_using.md`,
  `docs/discussions/2026-08-24_feedback_data_layer.md`

## Goal

There is exactly one way to bring music into the project — "add a track
from a file" — and a track's name always matches what it plays. The add
picker's contents stop changing as a side effect of other operations.

## The problem this fixes

A hands-on session on 2026-08-24 (with the developer driving and Claude
reproducing each observation against the code) confirmed four concrete
confusions:

1. **The per-card audio picker rewrites what a track plays but not what it
   says.** Choosing `pianobase_01.mp3` on the Night Drive card leaves
   "Night Drive / Sample Artist / 110 BPM" on the card and on every node,
   while pianobase plays. This is entrance A from the open-issue record,
   observed in practice.
2. **The add picker's contents churn.** It lists only files not attached
   to any track, so replacing a track's audio makes one file vanish from
   it and another appear. The rule is consistent but invisible; the
   developer experienced it as random.
3. **Two controls with the same look have different meanings** (replace
   vs. add), so it was unclear where music is supposed to enter at all.
4. **New nodes stack on top of existing ones.** `handleAddToCanvas` places
   nodes on a 30px diagonal cascade while a node is 140×82px, and ignores
   where existing nodes are. A saved project had the Midnight Piano Drift
   node fully covering the Night Drive node, which made the canvas read as
   the wrong graph (the edge appeared to leave the wrong node, and clicks
   selected a hidden node's cover).

## Decisions

1. **The per-card audio controls are removed** — both the server-file
   picker and the offline local-file import. This adopts option A of the
   open-issue record: one track = one audio file, fixed at creation. To
   change a track's audio, remove the track and add it again from the
   right file. The name/audio mismatch becomes impossible to create.
2. **The add picker lists every server file, always.** Files already
   attached to a track appear disabled with an "added" mark instead of
   being hidden. The no-duplicates rule from Phase 15 (decision 5) is
   kept, but it becomes visible instead of silently reshaping the list.
   This supersedes the "not offered again" wording of that decision.
3. **New nodes take the first free spot.** A pure helper walks the
   diagonal cascade and returns the first position whose node box does not
   overlap any existing node's box. No auto-layout; just never landing on
   top of someone.
4. **Offline mode becomes read-only for audio.** With the server down
   there is no way to attach audio (the mock tracks still render and the
   library still works). Keeping the offline import would keep a
   replace-style entrance alive, which is the bug class this phase
   removes. The server has been the normal way to run since Phase 14.
5. **The stub samples leave the saved project, with the developer's
   hands on the data.** `night-drive.wav` and `blue memory.wav` are
   2-second stubs carrying invented metadata (110/112 BPM, "Sample
   Artist"); they caused most of the 2026-08-24 confusion. As part of
   this phase the developer removes their tracks/nodes/edge from the
   running app (Remove buttons, then Save) or asks Claude to edit
   `data/project.json` with them watching. `mockProject.ts` itself stays
   as first-run/offline content (Phase 15, decision 3) — this cleanup is
   about the developer's saved data, which code must not silently rewrite.

Note on the open-issue record: it said to settle the library-classification
question (song vs. effect material) before picking option A/B/C. We are
deviating deliberately: removing a contradiction-producing entrance is
orthogonal to whatever classification is added later (a `kind` attribute or
sections can sit on top of "one track = one file" unchanged). The
classification question itself stays open and undecided.

## Scope

1. `src/domain/nodeLayout.ts` (+ test) — pure:
   - `freeNodePosition(nodes, nodeWidth, nodeHeight)`: first cascade spot
     whose box overlaps no existing node.
2. `src/components/TrackLibrary.tsx`:
   - delete `ServerFilePicker` and `TrackAudioImport` and their row in the
     card;
   - `AddTrackPicker` lists all server files; attached ones disabled with
     an "added" mark.
3. `src/App.tsx`:
   - delete `handleChooseServerFile` and `handleImportTrackAudio` and the
     props that carry them (the `WaveformCache.forget` calls added on
     2026-08-24 go with them — replacement no longer exists);
   - `handleAddToCanvas` uses `freeNodePosition`.
4. `src/index.css`: style for the disabled "added" options if the browser
   default is not legible enough.
5. Data cleanup (with the developer, not in code): stub tracks out of the
   saved project; optionally the stub `.wav` files out of `audio/`.

## Out of scope

- Everything in Phase 19 (server as source of truth, autosave, API
  cleanup) — recorded in
  `docs/discussions/2026-08-24_feedback_data_layer.md`.
- Renaming a track, editing artist/BPM, reading ID3 tags.
- Library classification (song vs. effect material) — still an open issue.
- Play / "Play from here" button wording (feedback item 3) — separate,
  confirmed valuable on 2026-08-24, but not part of the library.
- NEXT deck rules — to be decided together with transition positions.

## Trade-offs accepted

- Swapping a track's audio now takes remove + re-add, and loses nothing
  today because a track carries no state worth keeping beyond its file
  (title comes from the file; artist/BPM are empty on added tracks). When
  tracks gain editable metadata later, a real "replace audio, keep
  metadata" feature can be designed on purpose instead of existing by
  accident.
- Removing a track that is on the canvas still takes two steps (delete its
  nodes first) — unchanged from Phase 15.
- Offline sessions cannot attach audio at all anymore.

## Testing

- Unit: `freeNodePosition` (empty canvas; cascade spot taken → next free
  spot; several nodes taken; result never overlaps any input node).
- Existing TrackLibrary/App tests: update for the removed controls.
- Browser (verify skill): with all files attached, the add picker still
  shows them all, disabled and marked; add a track and see its file flip
  to disabled without anything else moving; a card has no audio picker;
  add several nodes in a row and confirm none covers another; the
  2026-08-17 open issue's reproduction steps are no longer possible.
