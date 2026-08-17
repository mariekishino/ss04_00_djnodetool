// Mock project data for NodeMix Canvas.
//
// This provides a small, hand-written sample graph so the UI can be
// developed before any real audio files or runtime data exist.
// IDs use human-readable strings (e.g. "track-001"); runtime-created
// entities will use crypto.randomUUID() instead.
//
// The tracks carry no audioUrl. They used to hold illustrative paths, which
// were harmless while audioUrl was unused but became two failed requests per
// load once Phase 14 started fetching it. Mock data should not claim that
// files exist; attach real audio from the audio/ folder instead.
//
// Source of truth: docs/04_domain_model.md

import type { Project } from "./types";

export const mockProject: Project = {
  id: "project-001",
  title: "Late Night Prototype Mix",
  tracks: [
    {
      id: "track-001",
      title: "Night Drive",
      artist: "Sample Artist",
      bpm: 110,
      durationSec: 180,
      tags: ["night", "drive", "smooth"],
    },
    {
      id: "track-002",
      title: "Blue Memory",
      artist: "Sample Artist",
      bpm: 112,
      durationSec: 200,
      tags: ["nostalgia", "blue", "soft"],
    },
  ],
  nodes: [
    {
      id: "node-001",
      trackId: "track-001",
      x: 100,
      y: 160,
      label: "Night Drive",
      color: "#3B82F6",
    },
    {
      id: "node-002",
      trackId: "track-002",
      x: 360,
      y: 220,
      label: "Blue Memory",
      color: "#6366F1",
    },
  ],
  edges: [
    {
      id: "edge-001",
      fromNodeId: "node-001",
      toNodeId: "node-002",
      transitionType: "crossfade",
      fadeDurationSec: 5,
      note: "smooth late-night transition",
    },
  ],
};
