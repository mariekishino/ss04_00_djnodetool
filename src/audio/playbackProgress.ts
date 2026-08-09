// The playback position the UI draws, and the pure rule for turning it into
// a 0..1 ratio.
//
// Phase 13: the AudioEngine measures the position against the AudioContext
// clock (the same one the audio is scheduled on) and hands out this plain
// snapshot. Keeping the shape free of Web Audio types means the UI, and any
// later consumer, never touches an AudioBuffer or AudioNode to draw a bar.

/** Where playback currently is, as plain numbers. */
export type PlaybackProgress = {
  nodeId: string;
  elapsedSec: number;
  durationSec: number;
};

/**
 * How far through the track playback is, from 0 to 1.
 *
 * Guards the cases a progress bar must not break on: a duration of 0 (or
 * something non-finite from odd metadata) reads as 0, and an elapsed time
 * past the end reads as 1 rather than overflowing the bar.
 */
export function progressRatio(elapsedSec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return 0;
  if (elapsedSec >= durationSec) return 1;
  return elapsedSec / durationSec;
}
