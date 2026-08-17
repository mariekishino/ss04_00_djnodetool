// Follow the playing track's position, for one node.
//
// Phase 16: extracted from NodeProgress now that the deck panel needs the
// same thing. Polling on requestAnimationFrame keeps the re-rendering inside
// whichever small component calls this hook, instead of pushing a new value
// through App sixty times a second.

import { useEffect, useRef, useState } from "react";
import type { PlaybackProgress } from "../audio/playbackProgress";

/**
 * The current playback position while `nodeId` is the node being played, or
 * null at any other time (nothing playing, or another node playing).
 *
 * Pass nodeId as null to follow nothing, which stops the animation loop.
 */
export function usePlaybackProgress(
  nodeId: string | null,
  getProgress: () => PlaybackProgress | null,
): PlaybackProgress | null {
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);

  // Keep the latest getter in a ref so the loop below stays a single effect
  // that does not restart when the caller re-renders.
  const getProgressRef = useRef(getProgress);
  useEffect(() => {
    getProgressRef.current = getProgress;
  }, [getProgress]);

  // No loop while there is nothing to follow.
  useEffect(() => {
    if (!nodeId) return;

    let frameId = 0;
    const tick = () => {
      const current = getProgressRef.current();
      // Ignore a snapshot for another node: during a fade the engine has
      // already moved on while this node is still on screen.
      setProgress(current?.nodeId === nodeId ? current : null);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [nodeId]);

  // Checked again on the way out rather than cleared in the effect: the stored
  // value can be one frame behind a change of node, and belongs to whoever it
  // names, not to whoever is asking now.
  return progress?.nodeId === nodeId ? progress : null;
}
