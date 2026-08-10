# Phase 11 Plan: Audio File Import (minimal slice)

- Date: 2026-07-26
- Status: approved (discussed with Claude, 2026-07-26)
- Inputs: docs/discussions/2026-07-12_mvp_completion_phase10.md (section 5),
  docs/10_decision_log.md (2026-07-10 Player/Analyzer split, 2026-07-12 MVP
  complete), docs/06_audio_engine_requirements.md

## Goal

A user can pick a local MP3/WAV file for a track and hear the real audio
when playing that track's node or a transition. This replaces the
oscillator placeholder as the audio source for tracks that have a file
loaded; tracks without a file keep the oscillator sound.

This is the first phase where decoded PCM exists, so it is also where the
Player/Analyzer boundary from the 2026-07-10 decision becomes concrete.

## Decisions (resolving the open questions from 2026-07-12, section 5)

1. **Persistence: in-memory only.** A picked file is decoded and held in
   memory; it is gone after a reload and must be picked again. Object URLs
   die on reload, and IndexedDB / File System Access API would pull the
   phase's focus away from decoding and playback. Persistent audio storage
   is deferred to a future phase (candidate: IndexedDB), which then slots
   in behind the same store interface.
2. **Decode once, at import.** File pick -> `arrayBuffer()` ->
   `decodeAudioData` -> keep the decoded result. Playback never decodes.
   (The file pick is a user gesture, so the AudioContext may be created
   there.)
3. **Analysis result storage: deferred.** The Analyzer still has no
   implementation, so nothing is decided about where `AnalysisResult`
   lives. `AnalysisResult` stays serializable-only (already decided).
4. **Decoded PCM lives in a dedicated store.** New module
   `src/audio/trackAudioStore.ts` maps `trackId -> AudioBuffer`. The
   Player side reads `AudioBuffer` from it; the future Analyzer side gets
   `Float32Array + sampleRate` via a dedicated accessor, so Web Audio
   types never cross the Analyzer boundary.

## Scope (what this slice implements)

1. `TrackAudioStore`: holds decoded audio per track
   (`set` / `get` / `has`, plus `pcmFor(trackId)` returning
   `{ samples: Float32Array, sampleRate: number } | null` as the future
   Analyzer entry point).
2. `AudioEngine.importTrackAudio(trackId, file): Promise<{ durationSec }>`:
   decodes the file into the store. The engine stays the only place that
   talks to the Web Audio API, so decoding belongs to it.
3. Playback uses the store: `createSourceForNode` (the swap point named in
   the Phase 8 comment) returns an `AudioBufferSourceNode` when the
   node's track has audio, otherwise the oscillator as today. The
   gain-envelope / transition logic is untouched — both source types are
   `AudioScheduledSourceNode`s.
4. UI: a "Load audio" file input per track in the Track Library
   (`accept="audio/*"`), plus a small loaded indicator (file name +
   duration). App keeps `trackAudioInfo: Map<trackId, { fileName,
   durationSec }>` React state for display; the store itself stays outside
   React.
5. Errors: a failed decode shows a simple alert (same pattern as JSON
   import) and leaves the store unchanged.

## Out of scope

- Persisting audio across reloads (IndexedDB / File System Access API).
- Saving anything audio-related into the project JSON (not even the file
  name; re-linking by name is a future convenience).
- Analyzer implementation, BPM detection, waveform display.
- Playback position, seeking, per-node start offsets.
- Updating `Track.bpm` / `Track.durationSec` domain fields (library BPM
  stays mock metadata; the loaded duration is display-only UI state).

## File changes

| File | Change |
|---|---|
| `src/audio/trackAudioStore.ts` | new: the trackId -> AudioBuffer store |
| `src/audio/trackAudioStore.test.ts` | new: unit tests with a minimal AudioBuffer stub |
| `src/audio/audioEngine.ts` | constructor takes a `TrackAudioStore`; add `importTrackAudio`; `createSourceForNode` prefers a buffer source |
| `src/components/TrackLibrary.tsx` | "Load audio" input + loaded indicator per track |
| `src/App.tsx` | own the store, pass it to the engine, `handleImportTrackAudio`, `trackAudioInfo` state |

## Trade-offs accepted

- Real audio plays at the same fixed gain as the oscillator placeholder;
  no per-track volume. Loudness tuning can come later.
- A buffer source plays from the start of the file every time; transitions
  preview "start of A -> start of B", same as today's semantics.
- Re-importing a file for the same track simply replaces the buffer.

## Testing

- Unit: store behavior (set/get/has, pcmFor extraction) with a stubbed
  AudioBuffer; existing 23 tests keep passing.
- Browser (verify skill): generate a small WAV in the scratchpad, drive
  the real UI — load it onto a track, play node and transition, check UI
  state and console for errors. The VM has no audio output, so audible
  confirmation is the user's part.
