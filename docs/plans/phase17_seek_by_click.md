# Phase 17 Plan: Seek by Clicking the Waveform

- Date: 2026-08-17
- Status: approved (discussed with Claude, 2026-08-17)
- Inputs: `docs/plans/phase16_deck_panel_waveform.md`
- Position: step 2 of 4. Step 1 (deck panel and waveform) is done; steps 3
  (transition ranges) and 4 (automatic BPM) are not part of this phase.

## Goal

Click anywhere on a deck's waveform and hear the track from that point.
Phase 16 made the shape of a track visible; this makes it reachable.

## How seeking works here

The Web Audio API has no "move the playhead" operation. A source node plays
once, from where it was told to start. Seeking therefore means: stop the
source that is playing and start a new one at an offset into the buffer
(`start(when, offset)`).

Everything that was derived from the old position has to follow:

- the reported position, so the progress bar and playhead do not jump back
  (the engine records the start time as `now - offset`, so elapsed reads as
  the offset immediately);
- a running sequence's hand-over timer, since the track now has a different
  amount of time left.

## Decisions

1. **Clicking while stopped starts playback from that point.** A click is an
   audition: the point of clicking a quiet part of the waveform is to hear
   what is there. Setting a start point without playing would need a stored
   "start position" per node, which belongs with transition ranges (step 3).
2. **Seeking during sequential playback is allowed, and the hand-over is
   rescheduled** from the new position. Forbidding it would be less work but
   would make the feature useless exactly when a set is running.
3. **Click only; no dragging.** Scrubbing has to decide what the audio does
   while the pointer moves, which is a much larger question (and the reason
   turntable-style scratching is its own feature, not a variation of this).
4. **Clicking a deck plays that deck's track from that point.** When it is
   the node already playing, the position moves within it and a running
   sequence continues. When it is the other deck, that track starts instead
   — auditioning the next track is a normal thing to want, and the
   alternative (silently ignoring the click) is worse than a predictable
   interruption.
5. **Only tracks with decoded audio respond.** A placeholder (oscillator)
   node has no buffer to offset into, and no waveform to click either.

## Scope

1. `src/audio/playbackProgress.ts` (+ test) — `offsetFromRatio(ratio,
   durationSec)`, the inverse of `progressRatio`, clamped to the track.
2. `src/audio/audioEngine.ts`:
   - `playNode(node, offsetSec = 0)` — start a node at an offset. The
     existing behaviour is the default argument, so callers are unchanged.
   - `startVoice` passes the offset to buffer sources only; an oscillator
     has no position to start from.
   - the recorded playback start time accounts for the offset.
3. `src/audio/sequencePlayer.ts`:
   - remember the node and duration of the current step;
   - `isRunning()`;
   - `seek(offsetSec)` — move within the current step and reschedule the
     hand-over from what is left;
   - `scheduleNextStep` takes how much of the track has already played.
4. `src/components/DeckPanel.tsx` — a click on the waveform reports where it
   landed as a 0..1 ratio; the waveform shows a pointer cursor when it can
   be clicked.
5. `src/App.tsx` — turn the ratio into an offset and route it either to the
   running sequence or to plain playback.

## Out of scope

- Dragging / scrubbing.
- Storing a start point per node (that is step 3's transition ranges).
- Seeking from the node's small progress bar on the canvas: too small a
  target to hit deliberately, and the deck is the place for this.
- Keyboard nudging, snapping to beats (needs analysis).

## File changes

| File | Change |
|---|---|
| `src/audio/playbackProgress.ts` (+ test) | `offsetFromRatio` |
| `src/audio/audioEngine.ts` | play from an offset; position bookkeeping |
| `src/audio/sequencePlayer.ts` | current step state, `isRunning`, `seek` |
| `src/components/DeckPanel.tsx` | waveform click |
| `src/App.tsx` | route the seek |
| `src/index.css` | pointer cursor on a clickable waveform |

## Trade-offs accepted

- A seek restarts the source, so there is a fade-out and fade-in of a few
  milliseconds rather than a sample-exact jump. Inaudible in practice, and
  it avoids a click.
- Clicking the other deck stops what is playing (decision 4).
- The click lands where the pixel is: with a four-minute track in a
  ~660-pixel deck, one pixel is about 0.4 seconds. Fine for finding a
  section, not for placing a cue point to the beat — that needs the zoom or
  the beat grid neither of which exists yet.

## Testing

- Unit: `offsetFromRatio` (start, middle, end, out-of-range, invalid
  duration), and that it round-trips with `progressRatio`.
- Browser (verify skill): click the middle of a playing track's waveform and
  confirm the reported position and playhead jump there and keep advancing;
  click while stopped and confirm playback starts from there; during
  sequential playback, seek near the end and confirm the hand-over to the
  next track still happens on time; click a deck with no audio and confirm
  nothing breaks. No console errors.
