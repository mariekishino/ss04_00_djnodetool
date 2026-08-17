// Talking to the local server (server/index.js).
//
// Phase 14: the app must work whether or not the server is running, so every
// call here resolves to a result object instead of throwing. "The server is
// not there" is an ordinary answer, handled in this one place, and the rest
// of the app just reads `available`.

import type { Project } from "../domain/types";
import { validateProject } from "./projectStorage";

/** One audio file sitting in the server's audio folder. */
export type ServerTrackFile = {
  fileName: string;
  url: string;
};

/** The file name inside an audio URL, for display. */
export function audioFileNameFromUrl(url: string): string {
  const lastSegment = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    // A malformed escape sequence should not break the display.
    return lastSegment;
  }
}

/**
 * The outcome of a server call.
 * - available: false means the server could not be reached at all.
 * - value is null when the server answered but had nothing (e.g. no project
 *   saved yet).
 */
export type ServerResult<T> = {
  available: boolean;
  value: T | null;
};

const unavailable = <T,>(): ServerResult<T> => ({
  available: false,
  value: null,
});

/** The audio files the server offers, or unavailable when it is not running. */
export async function fetchServerTracks(): Promise<
  ServerResult<ServerTrackFile[]>
> {
  try {
    const response = await fetch("/api/tracks");
    // A running server always answers this with 200. Anything else means it
    // is not reachable: in development the Vite proxy answers 500 rather than
    // failing the connection when nothing is listening behind it, so a status
    // check — not just a rejected fetch — is what detects "no server".
    if (!response.ok) return unavailable();
    const body = (await response.json()) as { tracks?: ServerTrackFile[] };
    return { available: true, value: body.tracks ?? [] };
  } catch {
    return unavailable();
  }
}

/**
 * The saved project, or a null value when the server is running but nothing
 * has been saved yet (a fresh checkout).
 */
export async function fetchServerProject(): Promise<ServerResult<Project>> {
  let body: { project?: unknown };
  try {
    const response = await fetch("/api/project");
    // As above: a non-OK status means the server is not answering, including
    // the proxy's 500 when nothing is listening behind it.
    if (!response.ok) return unavailable();
    body = (await response.json()) as { project?: unknown };
  } catch {
    return unavailable();
  }

  // A null project is the server saying "nothing saved yet".
  if (body.project == null) return { available: true, value: null };

  try {
    // Validate with the same rules as an imported file, so a hand-edited
    // project file cannot put a malformed project into the app.
    return { available: true, value: validateProject(body.project) };
  } catch {
    // The server is running, but its saved project is unusable.
    return { available: true, value: null };
  }
}

/** Save the project on the server. Returns whether it was written. */
export async function saveServerProject(
  project: Project,
): Promise<ServerResult<true>> {
  try {
    const response = await fetch("/api/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    return { available: true, value: response.ok ? true : null };
  } catch {
    return unavailable();
  }
}
