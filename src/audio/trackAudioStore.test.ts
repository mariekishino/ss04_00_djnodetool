// Unit tests for TrackAudioStore.
//
// Tests run in Node, where the real AudioBuffer does not exist, so a minimal
// stub provides the two members the store reads: getChannelData(0) and
// sampleRate.

import { describe, it, expect } from "vitest";
import { TrackAudioStore } from "./trackAudioStore";

function makeBuffer(samples: number[], sampleRate = 44100): AudioBuffer {
  const channel = new Float32Array(samples);
  const stub = {
    sampleRate,
    getChannelData: (channelIndex: number) => {
      if (channelIndex !== 0) throw new Error("stub has one channel");
      return channel;
    },
  };
  return stub as unknown as AudioBuffer;
}

describe("TrackAudioStore", () => {
  it("returns null / false for a track with no audio", () => {
    const store = new TrackAudioStore();
    expect(store.get("track-1")).toBeNull();
    expect(store.has("track-1")).toBe(false);
    expect(store.pcmFor("track-1")).toBeNull();
  });

  it("stores and returns a buffer per track", () => {
    const store = new TrackAudioStore();
    const buffer = makeBuffer([0, 0.5, -0.5]);
    store.set("track-1", buffer);

    expect(store.get("track-1")).toBe(buffer);
    expect(store.has("track-1")).toBe(true);
    expect(store.get("track-2")).toBeNull();
  });

  it("replaces the buffer when the same track is imported again", () => {
    const store = new TrackAudioStore();
    const first = makeBuffer([0.1]);
    const second = makeBuffer([0.2]);
    store.set("track-1", first);
    store.set("track-1", second);

    expect(store.get("track-1")).toBe(second);
  });

  it("exposes plain PCM (first channel + sample rate) via pcmFor", () => {
    const store = new TrackAudioStore();
    store.set("track-1", makeBuffer([0, 0.25, -0.25], 22050));

    const pcm = store.pcmFor("track-1");
    expect(pcm).not.toBeNull();
    expect(Array.from(pcm!.samples)).toEqual([0, 0.25, -0.25]);
    expect(pcm!.sampleRate).toBe(22050);
  });
});
