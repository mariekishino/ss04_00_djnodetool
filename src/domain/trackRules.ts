// Pure rules for the track library.
//
// Phase 15: adding a track from an audio file and removing one again. Both
// rules are decisions about the domain — what a new track is called, and
// whether removing one would leave a node dangling — so they live here and
// are unit tested without any UI.

import type { TrackNode } from "./types";

/**
 * The title a new track gets from its audio file name: the name without its
 * extension. `Midnight Piano Drift.mp3` becomes `Midnight Piano Drift`.
 *
 * A name with no extension, or one that is entirely an extension
 * (`.hidden`), is kept as it is rather than becoming empty — an odd title is
 * more useful than a blank row in the library.
 */
export function trackTitleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return fileName;
  return fileName.slice(0, dot);
}

/**
 * Whether any node on the canvas references this track.
 *
 * A node keeps only a `trackId`, so removing a track that is still in use
 * would leave the node pointing at nothing. Removal is blocked while this is
 * true.
 */
export function isTrackInUse(nodes: TrackNode[], trackId: string): boolean {
  return nodes.some((node) => node.trackId === trackId);
}
