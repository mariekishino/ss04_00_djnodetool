// TrackLibrary renders the list of tracks from Project.tracks.
//
// Phase 4: each entry now has an "Add to Canvas" button. Clicking it asks
// the parent (App) to create a new node from that track via onAddToCanvas.
// The library itself stays presentational; it does not own project state.
//
// Phase 15: the library can grow and shrink. A file in the audio folder can
// be added as a new track, and a track that no node uses can be removed.
//
// Phase 18: adding a track from a file in the server's audio folder is the
// only way audio enters the project. The per-track replace controls from
// Phases 11 and 14 (a local-file picker, then a server-file picker) are gone:
// they changed what a track played while its title, artist and BPM kept
// describing the old song. One track = one audio file, fixed at creation;
// to change the audio, remove the track and add it again. When audio is
// loaded, the entry shows the file name and duration from audioInfo. The
// library never touches audio APIs; App and the AudioEngine do the decoding.

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
  // running, in which case no tracks can be added (offline is read-only
  // for audio; Phase 18).
  serverFiles: ServerTrackFile[] | null;
  // Track ids that a node on the canvas uses; these cannot be removed.
  usedTrackIds: Set<string>;
  onAddToCanvas: (trackId: string) => void;
  onAddTrackFromAudio: (file: ServerTrackFile) => void;
  onRemoveTrack: (trackId: string) => void;
};

// The control that adds a track from an audio file. A file becomes a track by
// being chosen here; see docs/plans/phase15_track_library_editing.md for why
// this is explicit rather than the folder being mirrored into the library.
//
// Phase 18: every file is always listed. Files already attached to a track
// are disabled with an "added" mark instead of being hidden — hiding them
// made the list reshape itself as a side effect of other operations, which
// read as random. Duplicates stay impossible (Phase 15, decision 5): a song
// appears twice in a set as two nodes of one track, not as two tracks.
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

  if (serverFiles.length === 0) {
    return (
      <p className="library-hint">
        Put audio files in the audio/ folder to add tracks.
      </p>
    );
  }

  return (
    <select
      className="add-track-select"
      // Always shows the prompt: choosing is an action, not a setting.
      value=""
      onChange={(event) => {
        const chosen = serverFiles.find((f) => f.url === event.target.value);
        if (chosen) onAddTrackFromAudio(chosen);
      }}
    >
      <option value="">Add track from audio…</option>
      {serverFiles.map((file) => {
        const added = usedUrls.has(file.url);
        return (
          <option key={file.url} value={file.url} disabled={added}>
            {added ? `${file.fileName} (added)` : file.fileName}
          </option>
        );
      })}
    </select>
  );
}

function TrackLibrary({
  tracks,
  audioInfo,
  serverFiles,
  usedTrackIds,
  onAddToCanvas,
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
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export default TrackLibrary;
