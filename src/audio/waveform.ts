// Turning decoded audio into something drawable.
//
// Phase 16: a waveform is the sample list reduced to one value per pixel
// column — the loudest sample in that column's slice. This is data reduction,
// not analysis: nothing is estimated, so unlike BPM detection there is no
// library and no chance of a wrong answer.
//
// It takes plain PCM and returns plain numbers, so no Web Audio type crosses
// into the UI (the 2026-07-10 boundary rule).

/**
 * One peak per bucket: the loudest absolute sample in each equal slice of
 * `samples`, in the range 0..1 for normal audio.
 *
 * Buckets are laid out by sample index, so the last one absorbs the
 * remainder when the length does not divide evenly. Returns an empty array
 * for empty input or a non-positive bucket count.
 */
export function extractPeaks(
  samples: Float32Array,
  bucketCount: number,
): Float32Array {
  if (bucketCount <= 0 || samples.length === 0) return new Float32Array(0);

  const peaks = new Float32Array(bucketCount);
  const bucketSize = samples.length / bucketCount;

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor(bucket * bucketSize);
    // The final bucket runs to the end, so no samples are dropped.
    const end =
      bucket === bucketCount - 1
        ? samples.length
        : Math.floor((bucket + 1) * bucketSize);

    let peak = 0;
    // A bucket can be empty when there are fewer samples than buckets; it
    // keeps its 0 and the waveform simply has no height there.
    for (let i = start; i < end; i++) {
      const magnitude = Math.abs(samples[i]);
      if (magnitude > peak) peak = magnitude;
    }
    peaks[bucket] = peak;
  }

  return peaks;
}
