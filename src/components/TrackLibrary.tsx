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
//
// Phase 14: when the local server is running, the entry instead offers the
// files in its audio folder, which is what makes a track's audio survive a
// reload. The file picker remains as the fallback when there is no server.
//
// Phase 15: the library can grow and shrink. A file in the audio folder can
// be added as a new track, and a track that no node uses can be removed.

import { useRef } from "react";
import type { Track } from "../domain/types";
import type { ServerTrackFile } from "../storage/serverStorage";
import { formatTime } from "./formatTime";

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
  // The files in the server's audio folder. Null when the server is not
  // running, in which case the session-only file picker is offered instead.
  serverFiles: ServerTrackFile[] | null;
  // Track ids that a node on the canvas uses; these cannot be removed.
  usedTrackIds: Set<string>;
  onAddToCanvas: (trackId: string) => void;
  onImportAudio: (trackId: string, file: File) => void;
  onChooseServerFile: (trackId: string, file: ServerTrackFile) => void;
  onAddTrackFromAudio: (file: ServerTrackFile) => void;
  onRemoveTrack: (trackId: string) => void;
};

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

// One track's server-file picker: choose a file from the audio folder. The
// selected value is the track's current audioUrl, so the picker shows what is
// attached after a reload.
function ServerFilePicker({
  trackId,
  audioUrl,
  serverFiles,
  onChooseServerFile,
}: {
  trackId: string;
  audioUrl: string | undefined;
  serverFiles: ServerTrackFile[];
  onChooseServerFile: (trackId: string, file: ServerTrackFile) => void;
}) {
  if (serverFiles.length === 0) {
    return <span className="track-audio-hint">No files in audio/</span>;
  }

  return (
    <select
      className="server-file-select"
      value={audioUrl ?? ""}
      onChange={(event) => {
        const chosen = serverFiles.find((f) => f.url === event.target.value);
        if (chosen) onChooseServerFile(trackId, chosen);
      }}
    >
      <option value="">Choose audio…</option>
      {serverFiles.map((file) => (
        <option key={file.url} value={file.url}>
          {file.fileName}
        </option>
      ))}
    </select>
  );
}

// The control that adds a track, listing the audio files not already attached
// to one. A file becomes a track by being chosen here; see
// docs/plans/phase15_track_library_editing.md for why this is explicit rather
// than the folder being mirrored into the library.
function AddTrackPicker({
  tracks,
  serverFiles,
  onAddTrackFromAudio,
}: {
  tracks: Track[];
  serverFiles: ServerTrackFile[];
  onAddTrackFromAudio: (file: ServerTrackFile) => void;
}) {
  const usedUrls = new Set(
    tracks.map((track) => track.audioUrl).filter(Boolean),
  );
  const available = serverFiles.filter((file) => !usedUrls.has(file.url));

  if (available.length === 0) {
    return (
      <p className="library-hint">
        {serverFiles.length === 0
          ? "Put audio files in the audio/ folder to add tracks."
          : "Every file in audio/ is already a track."}
      </p>
    );
  }

  return (
    <select
      className="add-track-select"
      // Always shows the prompt: choosing is an action, not a setting.
      value=""
      onChange={(event) => {
        const chosen = available.find((f) => f.url === event.target.value);
        if (chosen) onAddTrackFromAudio(chosen);
      }}
    >
      <option value="">Add track from audio…</option>
      {available.map((file) => (
        <option key={file.url} value={file.url}>
          {file.fileName}
        </option>
      ))}
    </select>
  );
}

function TrackLibrary({
  tracks,
  audioInfo,
  serverFiles,
  usedTrackIds,
  onAddToCanvas,
  onImportAudio,
  onChooseServerFile,
  onAddTrackFromAudio,
  onRemoveTrack,
}: TrackLibraryProps) {
  return (
    <aside className="track-library">
      <h2>Track Library</h2>
      {serverFiles && (
        <AddTrackPicker
          tracks={tracks}
          serverFiles={serverFiles}
          onAddTrackFromAudio={onAddTrackFromAudio}
        />
      )}
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
                  ♪ {loaded.fileName} ({formatTime(loaded.durationSec)})
                </span>
              )}
              {/* Buttons first, then the audio control on its own row: the
                  sidebar is too narrow for all three side by side. */}
              <div className="track-item-actions">
                <button
                  type="button"
                  className="add-to-canvas-button"
                  onClick={() => onAddToCanvas(track.id)}
                >
                  Add to Canvas
                </button>
                <button
                  type="button"
                  className="remove-track-button"
                  disabled={usedTrackIds.has(track.id)}
                  title={
                    usedTrackIds.has(track.id)
                      ? "Delete this track's nodes from the canvas first"
                      : "Remove this track from the library"
                  }
                  onClick={() => onRemoveTrack(track.id)}
                >
                  Remove
                </button>
                {serverFiles ? (
                  <ServerFilePicker
                    trackId={track.id}
                    audioUrl={track.audioUrl}
                    serverFiles={serverFiles}
                    onChooseServerFile={onChooseServerFile}
                  />
                ) : (
                  <TrackAudioImport
                    trackId={track.id}
                    onImportAudio={onImportAudio}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default TrackLibrary;
