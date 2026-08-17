// NodeProgress draws the progress bar and elapsed / total time inside the
// node that is currently playing.
//
// Phase 13: this is one of the few parts of the UI that animates, so it is
// also one of the few that re-renders continuously. The polling itself lives
// in usePlaybackProgress (Phase 16), shared with the deck panel, so App and
// the canvas are not re-rendered sixty times a second.
//
// It receives a getter rather than the AudioEngine itself: the component
// never learns that Web Audio exists, and the value it reads is plain numbers
// (see audio/playbackProgress).

import type { PlaybackProgress } from "../audio/playbackProgress";
import { progressRatio } from "../audio/playbackProgress";
import { usePlaybackProgress } from "./usePlaybackProgress";
import { formatTime } from "./formatTime";

type NodeProgressProps = {
  nodeId: string;
  getProgress: () => PlaybackProgress | null;
};

function NodeProgress({ nodeId, getProgress }: NodeProgressProps) {
  const progress = usePlaybackProgress(nodeId, getProgress);

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
