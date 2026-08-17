// Unit tests for the track library rules.

import { describe, it, expect } from "vitest";
import type { TrackNode } from "./types";
import { trackTitleFromFileName, isTrackInUse } from "./trackRules";

function makeNode(id: string, trackId: string): TrackNode {
  return { id, trackId, x: 0, y: 0, label: "node" };
}

describe("trackTitleFromFileName", () => {
  it("drops the extension", () => {
    expect(trackTitleFromFileName("Midnight Piano Drift.mp3")).toBe(
      "Midnight Piano Drift",
    );
    expect(trackTitleFromFileName("take 1.wav")).toBe("take 1");
  });

  it("drops only the last extension", () => {
    expect(trackTitleFromFileName("mix.v2.final.mp3")).toBe("mix.v2.final");
  });

  it("keeps a name that has no extension", () => {
    expect(trackTitleFromFileName("untitled")).toBe("untitled");
  });

  it("keeps a name that is only an extension rather than emptying it", () => {
    expect(trackTitleFromFileName(".mp3")).toBe(".mp3");
  });
});

describe("isTrackInUse", () => {
  it("is false when no node references the track", () => {
    expect(isTrackInUse([], "track-1")).toBe(false);
    expect(isTrackInUse([makeNode("n1", "track-2")], "track-1")).toBe(false);
  });

  it("is true when a node references the track", () => {
    expect(isTrackInUse([makeNode("n1", "track-1")], "track-1")).toBe(true);
  });

  it("is true when one of several nodes references the track", () => {
    const nodes = [
      makeNode("n1", "track-2"),
      makeNode("n2", "track-1"),
      makeNode("n3", "track-3"),
    ];
    expect(isTrackInUse(nodes, "track-1")).toBe(true);
  });
});
