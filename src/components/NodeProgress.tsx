// NodeProgress draws the progress bar and elapsed / total time inside the
// node that is currently playing.
//
// Phase 13: this is the only part of the UI that animates, so it is also the
// only part that re-renders continuously. It polls the engine's progress
// snapshot on requestAnimationFrame and keeps the result in its own state, so
// App and the canvas are not re-rendered 60 times a second.
//
// It receives a getter rather than the AudioEngine itself: the component
// never learns that Web Audio exists, and the value it reads is plain numbers
// (see audio/playbackProgress).

import { useEffect, useRef, useState } from "react";
import type { PlaybackProgress } from "../audio/playbackProgress";
import { progressRatio } from "../audio/playbackProgress";
import { formatTime } from "./formatTime";

type NodeProgressProps = {
  nodeId: string;
  getProgress: () => PlaybackProgress | null;
};

function NodeProgress({ nodeId, getProgress }: NodeProgressProps) {
  const [progress, setProgress] = useState<PlaybackProgress | null>(null);

  // Keep the latest getter in a ref so the animation loop below can stay a
  // single effect that does not restart when App re-renders.
  const getProgressRef = useRef(getProgress);
  useEffect(() => {
    getProgressRef.current = getProgress;
  }, [getProgress]);

  useEffect(() => {
    let frameId = 0;
    const tick = () => {
      const current = getProgressRef.current();
      // Ignore a snapshot for another node: during a fade the engine has
      // already moved on while this node is still mounted and fading out.
      setProgress(current?.nodeId === nodeId ? current : null);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [nodeId]);

  // Nothing to draw for a node with no imported audio (the engine reports no
  // position for placeholder sounds).
  if (!progress) return null;

  const ratio = progressRatio(progress.elapsedSec, progress.durationSec);
  return (
    <div className="node-progress">
      <span className="node-progress-time">
        {formatTime(progress.elapsedSec)} / {formatTime(progress.durationSec)}
      </span>
      <div className="node-progress-track">
        <div
          className="node-progress-fill"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export default NodeProgress;
