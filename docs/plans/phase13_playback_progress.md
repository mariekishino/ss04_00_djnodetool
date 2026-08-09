# Phase 13 Plan: Playback Progress on the Graph

- Date: 2026-07-26
- Status: approved (discussed with Claude, 2026-07-26)
- Inputs: `docs/plans/phase12_sequential_playback.md`,
  `docs/10_decision_log.md` (2026-07-10 Player/Analyzer split)

## Goal

Show where playback currently is, on the graph itself: the playing node
carries a progress bar and a `1:23 / 3:45` time readout, and the edge being
crossed lights up while the two tracks overlap.

Phase 12 answered "which node is playing"; this phase answers "how far
into it are we", which is what makes a set of connections readable while
it plays.

## Decisions

1. **Bar + numbers on the node.** A progress bar plus elapsed / total time
   inside the playing node.
2. **Both playback modes.** The clock lives in the AudioEngine, so single
   `Play` and `Play from here` both show progress. The `Play transition`
   preview does not (it deliberately plays two track heads, not a
   position in a track).
3. **The edge lights up during a handover**, for exactly the fade duration.
4. **Only tracks with imported audio show progress.** A placeholder
   (oscillator) node has no real length; the 5s step length used by
   sequential playback is a scheduling device, not a position in a track,
   so showing a bar for it would be misleading.

## Timing source

Elapsed time is measured against `AudioContext.currentTime`, the same
clock the audio itself is scheduled on. `Date.now()` would slowly drift
away from what is heard.

The engine records, for the current track, the audio-clock time it starts
at and its duration. For a `fade` transition the target starts *after* the
fade, so the recorded start time is in the future and elapsed clamps to 0
until it begins.

## Rendering strategy

Re-rendering the whole app 60 times a second would be wasteful, so the two
moving parts are updated differently:

- **Progress bar / time**: a small `NodeProgress` component, mounted only
  inside the playing node, runs its own `requestAnimationFrame` loop and
  re-renders just itself.
- **Edge glow**: changes only twice per handover (on, then off after the
  fade), so it is plain React state in App, fed by a SequencePlayer
  callback — no animation loop needed.

## Scope

1. `src/audio/playbackProgress.ts` (+ test) — the `PlaybackProgress` type
   and pure `progressRatio(elapsedSec, durationSec)` clamped to 0..1.
2. `src/audio/audioEngine.ts` — record the current track's start time and
   duration in `playNode` / `startNode` / `transitionToNode`; clear it in
   `stop`; expose `playbackProgress(): PlaybackProgress | null`.
3. `src/audio/sequencePlayer.ts` — take listeners as an object
   (`onNowPlaying`, `onTransitionEdge`) and report the edge being crossed,
   clearing it after the fade.
4. `src/components/NodeProgress.tsx` (new) — the rAF ticker + bar + time.
5. `src/components/formatTime.ts` (new) — `formatTime(seconds)` as `m:ss`,
   extracted from the copy already in `TrackLibrary` so both use one.
6. `src/components/TrackNode.tsx` — render `NodeProgress` while playing.
7. `src/components/EdgeView.tsx` — `isTransitioning` style.
8. `src/components/NodeCanvas.tsx`, `src/App.tsx` — pass the progress
   getter and the transitioning edge id down.
9. `src/index.css` — progress bar and edge-glow styles.

## Out of scope

- Waveform display (needs the Analyzer; the bar becomes its playhead later).
- Seeking / scrubbing by clicking the bar.
- Progress for the `Play transition` preview.
- A global timeline panel outside the canvas.

## Trade-offs accepted

- Placeholder nodes show no bar (decision 4).
- During a crossfade the outgoing track is still audible while the
  highlight and progress have already moved to the incoming node; the edge
  glow is what signals the overlap.
- The bar is display-only: it cannot be dragged to seek.

## Testing

- Unit: `progressRatio` (start, middle, end, past the end, zero/invalid
  duration), `formatTime` (0, seconds padding, minutes).
- Browser (verify skill): with a short WAV loaded, start playback and
  confirm the bar advances and the time text increases, the edge glows
  during the handover and stops glowing after it, Stop clears everything,
  and a placeholder node shows no bar. No console errors.
