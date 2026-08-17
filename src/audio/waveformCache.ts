// Waveform peaks, computed once and kept.
//
// Phase 16: extracting peaks walks every sample of a track — around ten
// million for four minutes — so it must not happen on each render. The cache
// is keyed by track and by how many buckets were asked for, since a different
// panel width needs a different reduction.
//
// It lives in the audio layer rather than in a component: the UI asks for
// peaks and never learns where the samples come from.

import type { TrackAudioStore } from "./trackAudioStore";
import { extractPeaks } from "./waveform";

export class WaveformCache {
  private store: TrackAudioStore;
  private peaks = new Map<string, Float32Array>();

  constructor(store: TrackAudioStore) {
    this.store = store;
  }

  /**
   * The waveform peaks for a track, or null when it has no decoded audio
   * (a placeholder track, or one whose file has not loaded).
   */
  peaksFor(trackId: string, bucketCount: number): Float32Array | null {
    if (bucketCount <= 0) return null;

    const key = `${trackId}:${bucketCount}`;
    const cached = this.peaks.get(key);
    if (cached) return cached;

    const pcm = this.store.pcmFor(trackId);
    if (!pcm) return null;

    const computed = extractPeaks(pcm.samples, bucketCount);
    this.peaks.set(key, computed);
    return computed;
  }

  /** Forget a track's peaks, e.g. when its audio is replaced. */
  forget(trackId: string): void {
    for (const key of this.peaks.keys()) {
      if (key.startsWith(`${trackId}:`)) this.peaks.delete(key);
    }
  }
}
