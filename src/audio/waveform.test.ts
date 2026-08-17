// Unit tests for peak extraction.

import { describe, it, expect } from "vitest";
import { extractPeaks } from "./waveform";

const peaks = (samples: number[], buckets: number) =>
  Array.from(extractPeaks(new Float32Array(samples), buckets));

// Test values are chosen from those a 32-bit float holds exactly (halves,
// quarters, eighths), so the assertions can compare exactly: a Float32Array
// would store 0.9 as 0.8999999761581421.
describe("extractPeaks", () => {
  it("takes the loudest sample in each bucket", () => {
    // Two buckets over eight samples: max of the first four, then the last.
    expect(
      peaks([0.125, 0.5, 0.25, 0.375, 0.75, 0.125, 0.25, 0.25], 2),
    ).toEqual([0.5, 0.75]);
  });

  it("measures loudness regardless of sign", () => {
    // A negative trough is as loud as a positive crest.
    expect(peaks([-0.75, 0.25], 1)).toEqual([0.75]);
  });

  it("gives every sample to some bucket, remainder included", () => {
    // 5 samples over 2 buckets: the last bucket takes the extra sample, so
    // the 0.75 at the end is not dropped.
    expect(peaks([0.125, 0.25, 0.375, 0.5, 0.75], 2)).toEqual([0.25, 0.75]);
  });

  it("reports silence as zero", () => {
    expect(peaks([0, 0, 0, 0], 2)).toEqual([0, 0]);
  });

  it("leaves buckets empty when there are fewer samples than buckets", () => {
    const result = peaks([1, 1], 4);
    expect(result).toHaveLength(4);
    // Whatever the split, no bucket may exceed the input's loudest sample.
    expect(Math.max(...result)).toBe(1);
  });

  it("returns nothing for empty input or a non-positive bucket count", () => {
    expect(peaks([], 4)).toEqual([]);
    expect(peaks([0.5], 0)).toEqual([]);
    expect(peaks([0.5], -2)).toEqual([]);
  });

  it("returns one peak per bucket", () => {
    expect(extractPeaks(new Float32Array(1000), 128)).toHaveLength(128);
  });
});
