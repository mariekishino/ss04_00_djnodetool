// DeckPanel: the strip along the bottom showing two decks — the track
// playing now, and the one playback would move to next.
//
// Phase 16: this is where a track's shape becomes visible. A waveform shows
// where the track is loud and where it is quiet, which is how a DJ picks a
// place to mix without listening through the whole track first.
//
// The waveform is drawn on a canvas once per track and width; only the
// playhead moves per frame, via usePlaybackProgress.
//
// Phase 17: clicking the waveform reports where it landed as a 0..1 ratio.
// The deck stays presentational — it does not know what a seek is; App turns
// the ratio into a position and decides what to do with it.

import { useEffect, useRef, useState } from "react";
import type { Track, TrackNode } from "../domain/types";
import type { PlaybackProgress } from "../audio/playbackProgress";
import { progressRatio } from "../audio/playbackProgress";
import { usePlaybackProgress } from "./usePlaybackProgress";
import { formatTime } from "./formatTime";

// Height of the drawn waveform in CSS pixels.
const WAVEFORM_HEIGHT = 56;

type DeckProps = {
  label: string;
  node: TrackNode | null;
  track: Track | null;
  // Peaks for the track, one per horizontal pixel, or null when it has no
  // decoded audio. Asked for by width, so the deck reports its own width.
  getPeaks: (trackId: string, bucketCount: number) => Float32Array | null;
  getProgress: () => PlaybackProgress | null;
  onChangeBpm: (trackId: string, bpm: number | undefined) => void;
  onSeek: (node: TrackNode, ratio: number) => void;
};

// Draw the peaks as vertical bars around a centre line. Nothing about this is
// interactive yet, so the canvas is redrawn only when its inputs change.
function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  color: string,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  // Draw at device resolution so the waveform is not blurry, while the CSS
  // size stays in layout pixels.
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  canvas.width = Math.max(1, Math.floor(width * ratio));
  canvas.height = Math.floor(WAVEFORM_HEIGHT * ratio);
  context.scale(ratio, ratio);

  context.clearRect(0, 0, width, WAVEFORM_HEIGHT);
  context.fillStyle = color;

  const middle = WAVEFORM_HEIGHT / 2;
  for (let x = 0; x < peaks.length && x < width; x++) {
    // A peak of 1 fills the full height; silence still leaves a hairline so
    // the track's length stays visible.
    const height = Math.max(1, peaks[x] * WAVEFORM_HEIGHT);
    context.fillRect(x, middle - height / 2, 1, height);
  }
}

function Deck({
  label,
  node,
  track,
  getPeaks,
  getProgress,
  onChangeBpm,
  onSeek,
}: DeckProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The canvas width in layout pixels, measured after layout so the number of
  // peaks matches the pixels available.
  const [width, setWidth] = useState(0);

  const progress = usePlaybackProgress(node?.id ?? null, getProgress);

  // Follow the panel's width so the waveform is recomputed at the resolution
  // it is drawn at.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(canvas);
    setWidth(Math.floor(canvas.clientWidth));
    return () => observer.disconnect();
  }, [track?.id]);

  // Redraw when the track, the width, or the loaded audio changes. Peaks are
  // cached by the caller, so this stays cheap after the first draw.
  const peaks = track && width > 0 ? getPeaks(track.id, width) : null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    // The waveform uses the theme's text colour, read from the element so the
    // canvas follows the stylesheet rather than hard-coding it.
    const color = getComputedStyle(canvas).color;
    drawWaveform(canvas, peaks, color);
  }, [peaks]);

  // Only a track with a waveform has somewhere to seek to.
  const canSeek = peaks !== null && node !== null;

  const durationSec = progress?.durationSec;
  const playedRatio = progress
    ? progressRatio(progress.elapsedSec, progress.durationSec)
    : 0;

  return (
    <section className="deck">
      <header className="deck-header">
        <span className="deck-label">{label}</span>
        <span className="deck-title">{track ? track.title : "—"}</span>
        {track?.artist && <span className="deck-artist">{track.artist}</span>}
      </header>

      <div className="deck-meta">
        <span className="deck-time">
          {progress
            ? `${formatTime(progress.elapsedSec)} / ${formatTime(durationSec ?? 0)}`
            : "—"}
        </span>
        {track && (
          <label className="deck-bpm">
            BPM
            <input
              type="number"
              min={0}
              step={1}
              value={track.bpm ?? ""}
              placeholder="—"
              onChange={(event) => {
                const parsed = Number(event.target.value);
                onChangeBpm(
                  track.id,
                  event.target.value === "" || !Number.isFinite(parsed)
                    ? undefined
                    : parsed,
                );
              }}
            />
          </label>
        )}
      </div>

      <div
        className={
          canSeek ? "deck-waveform seekable" : "deck-waveform"
        }
        style={{ height: WAVEFORM_HEIGHT }}
        onClick={(event) => {
          if (!canSeek || !node) return;
          // Where the click landed along the waveform, as 0..1.
          const bounds = event.currentTarget.getBoundingClientRect();
          onSeek(node, (event.clientX - bounds.left) / bounds.width);
        }}
      >
        <canvas
          ref={canvasRef}
          className="deck-waveform-canvas"
          style={{ height: WAVEFORM_HEIGHT }}
        />
        {!peaks && (
          <span className="deck-waveform-empty">
            {track ? "No audio loaded" : "Nothing selected"}
          </span>
        )}
        {progress && (
          <div
            className="deck-playhead"
            style={{ left: `${playedRatio * 100}%` }}
          />
        )}
      </div>
    </section>
  );
}

type DeckPanelProps = {
  nowNode: TrackNode | null;
  nowTrack: Track | null;
  nextNode: TrackNode | null;
  nextTrack: Track | null;
  getPeaks: (trackId: string, bucketCount: number) => Float32Array | null;
  getProgress: () => PlaybackProgress | null;
  onChangeBpm: (trackId: string, bpm: number | undefined) => void;
  onSeek: (node: TrackNode, ratio: number) => void;
};

function DeckPanel({
  nowNode,
  nowTrack,
  nextNode,
  nextTrack,
  getPeaks,
  getProgress,
  onChangeBpm,
  onSeek,
}: DeckPanelProps) {
  return (
    <div className="deck-panel">
      <Deck
        label="NOW"
        node={nowNode}
        track={nowTrack}
        getPeaks={getPeaks}
        getProgress={getProgress}
        onChangeBpm={onChangeBpm}
        onSeek={onSeek}
      />
      <Deck
        label="NEXT"
        node={nextNode}
        track={nextTrack}
        getPeaks={getPeaks}
        getProgress={getProgress}
        onChangeBpm={onChangeBpm}
        onSeek={onSeek}
      />
    </div>
  );
}

export default DeckPanel;
