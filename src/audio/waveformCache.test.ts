// Unit tests for the waveform cache.
//
// The store is stubbed: what matters here is that samples are read once per
// track and width, not how they were decoded.

import { describe, it, expect } from "vitest";
import type { TrackAudioStore } from "./trackAudioStore";
import { WaveformCache } from "./waveformCache";

function makeStore(samplesByTrack: Record<string, number[]>) {
  let pcmCalls = 0;
  const store = {
    pcmFor(trackId: string) {
      pcmCalls++;
      const samples = samplesByTrack[trackId];
      if (!samples) return null;
      return { samples: new Float32Array(samples), sampleRate: 44100 };
    },
  };
  return {
    store: store as unknown as TrackAudioStore,
    calls: () => pcmCalls,
  };
}

describe("WaveformCache", () => {
  it("returns peaks for a track with audio", () => {
    // Values a 32-bit float holds exactly, so the comparison is exact.
    const { store } = makeStore({ "track-1": [0.125, 0.75, 0.25, 0.375] });
    const cache = new WaveformCache(store);

    expect(Array.from(cache.peaksFor("track-1", 2)!)).toEqual([0.75, 0.375]);
  });

  it("computes once and reuses the result", () => {
    const { store, calls } = makeStore({ "track-1": [0.5, 0.2] });
    const cache = new WaveformCache(store);

    const first = cache.peaksFor("track-1", 2);
    const second = cache.peaksFor("track-1", 2);

    expect(second).toBe(first);
    expect(calls()).toBe(1);
  });

  it("caches per bucket count, since a different width needs different peaks", () => {
    const { store, calls } = makeStore({ "track-1": [0.1, 0.9, 0.2, 0.4] });
    const cache = new WaveformCache(store);

    expect(cache.peaksFor("track-1", 2)).toHaveLength(2);
    expect(cache.peaksFor("track-1", 4)).toHaveLength(4);
    expect(calls()).toBe(2);
  });

  it("returns null for a track with no decoded audio", () => {
    const { store } = makeStore({});
    const cache = new WaveformCache(store);

    expect(cache.peaksFor("missing", 8)).toBeNull();
  });

  it("returns null for a non-positive bucket count", () => {
    const { store } = makeStore({ "track-1": [0.5] });
    const cache = new WaveformCache(store);

    expect(cache.peaksFor("track-1", 0)).toBeNull();
  });

  it("recomputes after the track is forgotten", () => {
    const { store, calls } = makeStore({ "track-1": [0.5, 0.2] });
    const cache = new WaveformCache(store);

    cache.peaksFor("track-1", 2);
    cache.forget("track-1");
    cache.peaksFor("track-1", 2);

    expect(calls()).toBe(2);
  });
});
