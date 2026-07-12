# Audio Engine Requirements

## Goal

The audio engine for the MVP should be simple, understandable, and isolated from the UI.

It should prove that connected track nodes can produce a basic playback transition.

The first version is not a professional DJ engine.

## MVP Audio Features

The MVP audio engine should support:

1. Load an audio source
2. Play one track
3. Stop playback
4. Fade out one track
5. Fade in another track
6. Crossfade from one track to another
7. Use `fadeDurationSec` from `TransitionEdge`

## Recommended Browser API

Use the Web Audio API.

The core concepts should be:

- `AudioContext`
- `AudioBuffer`
- `AudioBufferSourceNode`
- `GainNode`

## Basic Audio Flow

```txt
AudioBufferSourceNode -> GainNode -> AudioContext.destination
```

For crossfade:

```txt
Track A Source -> Gain A -> destination
Track B Source -> Gain B -> destination

Gain A decreases over fadeDurationSec.
Gain B increases over fadeDurationSec.
```

## Required Engine Operations

The audio module should expose a small API.

Example:

```ts
export type AudioEngine = {
  loadTrack(trackId: string, audioUrl: string): Promise<void>;
  playTrack(trackId: string): Promise<void>;
  stop(): void;
  crossfade(
    fromTrackId: string,
    toTrackId: string,
    fadeDurationSec: number
  ): Promise<void>;
};
```

This exact API can change if needed, but the concept should remain small.

## Separation from UI

Audio logic should not be implemented directly inside React components.

Good:

```txt
src/audio/audioEngine.ts
src/components/PlayerControls.tsx
```

Bad:

```txt
All Web Audio API logic inside App.tsx
```

React components should call the audio engine.

They should not own low-level audio behavior.

## Access Pattern

Create one `AudioEngine` instance at the app level (`App.tsx`).

Pass it to components that need it through props.

Do not use React Context for the audio engine unless prop drilling becomes unmanageable.

## MVP Limitations

Do not implement the following in the first version:

- beat matching
- BPM detection
- pitch shifting
- time stretching
- waveform visualization
- cue points
- looping
- EQ controls
- filters
- compression
- limiter
- recording/exporting mixed audio
- multi-deck DJ interface
- external streaming service playback

## Local Audio Policy

For the MVP, use only:

- local test audio files
- mock audio files
- user-provided local files
- royalty-free test files

Do not use Spotify, Apple Music, YouTube, or other streaming sources in the MVP.

## Playback Behavior

### Cut

Immediately stop the first track and start the second track.

### Fade

Fade out the first track completely, then start the second track at full volume.

### Crossfade

Play both tracks at the same time during the transition.

During the transition:

- first track volume goes from 1 to 0
- second track volume goes from 0 to 1
- duration is controlled by `fadeDurationSec`

## Error Handling

The audio engine should handle:

- missing audio URL
- failed audio loading
- unsupported audio file
- user pressing stop during playback
- user triggering another playback while one is already active

The MVP can show simple error messages.

## Implementation Priorities

Build in this order:

1. Play one hardcoded audio file
2. Play a track by trackId
3. Stop playback
4. Play two tracks manually
5. Implement fade
6. Implement crossfade
7. Connect crossfade to TransitionEdge

## Quality Requirements

- Keep the audio engine small.
- Keep state explicit.
- Avoid hidden global state where possible.
- Do not create many overlapping AudioContexts.
- Clean up old source nodes after playback.
- Write comments for Web Audio API behavior that may be non-obvious.

## Future Features

Future versions may support:

- waveform display
- beat grid
- cue points
- automatic BPM analysis
- AI-assisted transition suggestions
- effect chains
- filters
- loops
- export to audio file
- performance mode

These are out of scope for the MVP.

## Future Direction: Player / Analyzer Split

Decided on 2026-07-10 (see `docs/10_decision_log.md` and
`docs/discussions/2026-07-10_claude_audioengine_ts_dsp-poems.md`).

The audio layer has two conceptually different parts, and only one of them
is ever a candidate for replacement:

| Part | Role | Replaceable? |
|---|---|---|
| **Player** | load / play / stop / crossfade / position events | No. Always JS + Web Audio API. The browser's audio output is always Web Audio, so a C++/WASM rewrite of playback is not meaningful. |
| **Analyzer** (future) | takes PCM, returns analysis results (BPM, beats, waveform peaks) | Yes. Implementations can be swapped: simple JS library → high-accuracy WASM library (e.g. essentia.js) → hand-written C++/WASM (learning purpose only). |

The existing `AudioEngine` in `src/audio/audioEngine.ts` is the Player.
It is not a swap target and its abstraction can stay thin.

When analysis features are added, the `Analyzer` interface must follow
these boundary rules. Portability to Workers and WASM is guaranteed by
the data types crossing the boundary, not by the class design:

1. No Web Audio types in the interface. Use `Float32Array` + `sampleRate`,
   never `AudioBuffer` or `AudioNode` (they cannot cross a Worker boundary
   and do not exist in C++).
2. Everything async (`Promise`), because real implementations run in a
   Worker.
3. Results are plain serializable data only (numbers, arrays,
   `Float32Array`). No class instances, no functions.
4. Decoding (MP3 → PCM) stays on the JS side via `decodeAudioData`, so the
   Analyzer input is always raw PCM.

Sketch:

```ts
interface Analyzer {
  analyze(pcm: Float32Array, sampleRate: number): Promise<AnalysisResult>;
}

interface AnalysisResult {
  bpm: number;
  beats: number[];             // beat positions in seconds
  waveformPeaks: Float32Array; // downsampled peaks for display
  duration: number;
}
```

Do not implement the Analyzer, or design it in more detail, before a
feature actually needs it. The MVP needs no analysis at all.