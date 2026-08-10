// Shared time formatting for the UI.
//
// Phase 13: both the Track Library (a loaded file's length) and the playing
// node (elapsed / total) show times, so the m:ss rule lives in one place.

/** Seconds as `m:ss`, e.g. 83 -> "1:23". Invalid input reads as "0:00". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
