// Pure helpers for the local server.
//
// Phase 14: kept separate from the request handling so they can be unit
// tested. The path guard is the security-relevant part: a request must not
// be able to name a file outside the audio folder.

// Audio types the browser can decode; anything else is not offered.
const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

/** The audio file extensions the server lists and serves. */
export const AUDIO_EXTENSIONS = Object.keys(CONTENT_TYPES);

/**
 * True when `fileName` names a file directly inside the audio folder.
 *
 * Rejects anything with a path separator or a parent-directory step, so a
 * request cannot reach outside the folder, and anything that is not a
 * supported audio file.
 */
export function isSafeAudioFileName(fileName) {
  if (typeof fileName !== "string" || fileName.length === 0) return false;
  if (fileName.includes("/") || fileName.includes("\\")) return false;
  // Covers "..", "..foo" is fine but a leading dot file is not useful here.
  if (fileName.startsWith(".")) return false;
  return AUDIO_EXTENSIONS.includes(extensionOf(fileName));
}

/** The lower-cased extension including the dot, or "" when there is none. */
export function extensionOf(fileName) {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return "";
  return fileName.slice(dot).toLowerCase();
}

/** The Content-Type for an audio file name, or a safe generic fallback. */
export function contentTypeFor(fileName) {
  return CONTENT_TYPES[extensionOf(fileName)] ?? "application/octet-stream";
}
