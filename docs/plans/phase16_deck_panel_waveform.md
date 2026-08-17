# Phase 16 Plan: Deck Panel and Waveform

- Date: 2026-08-17
- Status: approved (discussed with Claude, 2026-08-17)
- Inputs: `docs/10_decision_log.md` (2026-07-10 Player / Analyzer split),
  `docs/plans/phase13_playback_progress.md`
- Position: step 1 of 4 towards choosing transition points by eye. Steps 2-4
  (seek by click, transition ranges, automatic BPM) are not part of this
  phase.

## Goal

A panel across the bottom of the app showing two decks — the track playing
now and the one playback would move to next — each with its waveform, its
position in the track, and its BPM.

Seeing a track's shape is what lets a DJ choose where to mix: the intro,
the drop and the quiet section are all visible in the waveform, without
listening through the track to find them.

## What a waveform is here, and why it needs no analysis

Decoded audio is a long list of numbers (about 10 million for a four-minute
track). A waveform is that list reduced to one value per pixel column: for
each column, the loudest sample in its slice. Drawing those values gives
the familiar shape.

This is data reduction, not analysis — no estimation, nothing to be wrong
about, no library. The 2026-07-10 discussion already noted peak extraction
as a "write it yourself in a few dozen lines" job, in contrast with BPM
detection.

The material is already there: `TrackAudioStore.pcmFor()` was built in
Phase 11 as the entry point for exactly this and has never been used.

## Decisions

1. **Two decks: NOW and NEXT.** NOW shows the node currently playing, or
   the selected node when nothing plays. NEXT shows where playback would go
   from there, following the same first-outgoing-edge rule as sequential
   playback (`findNextEdge`). So the panel always answers "what is playing,
   and what comes after".
2. **BPM is typed in, not detected.** `Track.bpm` exists and holds mock
   values today; the deck makes it editable. Automatic detection is a later
   phase that fills the same field, so no UI or data is thrown away.
   Detection was deferred because a wrong number is worse than no number
   while there is nothing to check it against.
3. **Peak extraction stays synchronous and pure.** The recorded rule that
   analysis should be async (for a future Worker/WASM swap) is about the
   `Analyzer` interface for estimation work like BPM. Peak extraction is a
   fixed calculation over the samples, fast enough to run inline, and a
   `Promise` here would be ceremony. When the real Analyzer arrives it will
   follow the recorded rules.
4. **Peaks are cached per track and width.** Recomputing 10 million samples
   on every render would be wasteful. The cache is keyed by track and
   bucket count and lives in the audio layer, not in a component.
5. **The waveform is drawn on a canvas; the playhead is a separate
   element.** The canvas is drawn once per track/width change. The moving
   playhead is a positioned element updated on `requestAnimationFrame`, the
   same approach Phase 13 used, so nothing redraws the waveform per frame.
6. **The rAF polling from Phase 13 is extracted into a shared hook**, now
   that both the node's progress bar and the deck's playhead need it.

## Scope

1. `src/audio/waveform.ts` (+ test) — `extractPeaks(samples, bucketCount)`:
   the loudest absolute sample per bucket, as a `Float32Array`. Takes plain
   PCM, returns plain numbers; no Web Audio types cross it.
2. `src/audio/waveformCache.ts` (+ test) — peaks per `trackId:bucketCount`,
   computed on first request from the `TrackAudioStore`.
3. `src/components/usePlaybackProgress.ts` — the rAF hook extracted from
   `NodeProgress`, reused by the deck.
4. `src/components/DeckPanel.tsx` — the bottom panel: two decks, each with
   title, artist, elapsed / total, a BPM input, a waveform canvas and a
   playhead.
5. `src/App.tsx` — resolve the NOW and NEXT nodes, provide the peaks getter,
   handle BPM edits, and place the panel below the existing layout.
6. `src/index.css` — panel layout and deck styles.

## Out of scope

- Clicking the waveform to seek (step 2).
- Choosing transition ranges (step 3).
- Automatic BPM detection (step 4).
- Changing playback speed. It is one line to set `playbackRate`, but the
  track's effective length then changes, which ripples into the progress
  display, the sequence's transition timing and the playhead. It is also
  only meaningful once BPM is known, so it waits.
- Zooming or scrolling the waveform.
- Showing a waveform for placeholder (oscillator) tracks: they have no
  decoded audio, so the deck shows the track without one.

## File changes

| File | Change |
|---|---|
| `src/audio/waveform.ts` (+ test) | new: peak extraction |
| `src/audio/waveformCache.ts` (+ test) | new: cache per track and width |
| `src/components/usePlaybackProgress.ts` | new: shared rAF polling |
| `src/components/NodeProgress.tsx` | use the shared hook |
| `src/components/DeckPanel.tsx` | new: the bottom panel |
| `src/App.tsx` | NOW / NEXT resolution, peaks getter, BPM edit, layout |
| `src/index.css` | panel and deck styles |

## Trade-offs accepted

- One value per column (loudest absolute sample) rather than a separate
  minimum and maximum, so the waveform is symmetric. It shows the shape
  that matters here — where the track is loud and where it is quiet — with
  half the data and simpler code.
- Peaks are recomputed when the panel width changes; they are not resampled
  from a stored high-resolution set.
- The cache lives for the session, like the decoded audio itself.

## Testing

- Unit: `extractPeaks` (bucket boundaries, fewer samples than buckets,
  silence, negative peaks, empty input), `waveformCache` (computes once,
  caches per width, returns null for a track with no audio).
- Browser (verify skill): with a track playing, the NOW deck shows its
  waveform and the playhead advances; the NEXT deck shows the track the
  sequence would move to; a BPM typed into a deck appears in the library
  and survives a save and reload; a track without audio shows no waveform
  but no error. No console errors.
