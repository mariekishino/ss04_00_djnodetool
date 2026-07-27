// TrackLibrary renders the list of tracks from Project.tracks.
//
// Phase 4: each entry now has an "Add to Canvas" button. Clicking it asks
// the parent (App) to create a new node from that track via onAddToCanvas.
// The library itself stays presentational; it does not own project state.
//
// Phase 11: each entry has a "Load audio" button that opens a file picker
// and passes the picked file up via onImportAudio. When audio is loaded,
// the entry shows the file name and duration from audioInfo. The library
// never touches audio APIs; App and the AudioEngine do the decoding.

import { useRef } from "react";
import type { Track } from "../domain/types";

/**
 * Display info for a track whose audio was imported this session.
 * UI state only — it is not part of the project and is not saved.
 */
export type TrackAudioInfo = {
  fileName: string;
  durationSec: number;
};

type TrackLibraryProps = {
  tracks: Track[];
  audioInfo: Map<string, TrackAudioInfo>;
  onAddToCanvas: (trackId: string) => void;
  onImportAudio: (trackId: string, file: File) => void;
};

// Format a duration in seconds as m:ss for the loaded-audio indicator.
function formatDuration(durationSec: number): string {
  const totalSeconds = Math.round(durationSec);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// One track's "Load audio" control: a visible button driving a hidden file
// input (same pattern as ProjectToolbar's Import JSON). A separate component
// so each track owns its own input ref.
function TrackAudioImport({
  trackId,
  onImportAudio,
}: {
  trackId: string;
  onImportAudio: (trackId: string, file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onImportAudio(trackId, file);
    }
    // Reset so selecting the same file again still fires a change event.
    event.target.value = "";
  }

  return (
    <>
      <button
        type="button"
        className="load-audio-button"
        onClick={() => fileInputRef.current?.click()}
      >
        Load audio
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="toolbar-file-input"
        onChange={handleFileChange}
      />
    </>
  );
}

function TrackLibrary({
  tracks,
  audioInfo,
  onAddToCanvas,
  onImportAudio,
}: TrackLibraryProps) {
  return (
    <aside className="track-library">
      <h2>Track Library</h2>
      <ul className="track-list">
        {tracks.map((track) => {
          const loaded = audioInfo.get(track.id);
          return (
            <li key={track.id} className="track-item">
              <span className="track-title">{track.title}</span>
              {track.artist && (
                <span className="track-artist">{track.artist}</span>
              )}
              {track.bpm !== undefined && (
                <span className="track-bpm">{track.bpm} BPM</span>
              )}
              {loaded && (
                <span className="track-audio-loaded">
                  ♪ {loaded.fileName} ({formatDuration(loaded.durationSec)})
                </span>
              )}
              <div className="track-item-actions">
                <button
                  type="button"
                  className="add-to-canvas-button"
                  onClick={() => onAddToCanvas(track.id)}
                >
                  Add to Canvas
                </button>
                <TrackAudioImport
                  trackId={track.id}
                  onImportAudio={onImportAudio}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default TrackLibrary;
