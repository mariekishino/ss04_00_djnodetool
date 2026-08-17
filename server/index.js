// The local server for NodeMix Canvas.
//
// Phase 14: it exists so that audio files and the project survive a reload.
// Its scope is deliberately fixed and small (see
// docs/plans/phase14_local_server_persistence.md):
//
//   GET  /api/tracks    list the audio files in audio/
//   GET  /audio/<file>  serve one of them
//   GET  /api/project   the saved project, 404 when nothing is saved
//   PUT  /api/project   save the request body as the project
//
// No authentication, no database, no upload, no cloud sync. Plain Node with
// no dependencies and no build step: Vite proxies /api and /audio here, so
// the browser only ever talks to the Vite origin and CORS never comes up.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSafeAudioFileName,
  contentTypeFor,
  AUDIO_EXTENSIONS,
  extensionOf,
} from "./paths.js";

const PORT = 5200;
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIO_DIR = join(projectRoot, "audio");
const DATA_DIR = join(projectRoot, "data");
const PROJECT_FILE = join(DATA_DIR, "project.json");

// A saved project is a single JSON document; refuse anything unreasonable
// rather than writing whatever arrives to disk.
const MAX_PROJECT_BYTES = 5 * 1024 * 1024;

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

// The audio files available to the app, newest name order kept simple:
// alphabetical, which is stable and predictable in the UI.
async function listAudioFiles() {
  let entries;
  try {
    entries = await readdir(AUDIO_DIR, { withFileTypes: true });
  } catch {
    // No audio folder yet is normal on a fresh checkout.
    return [];
  }
  return entries
    .filter(
      (entry) =>
        entry.isFile() && AUDIO_EXTENSIONS.includes(extensionOf(entry.name)),
    )
    .map((entry) => ({
      fileName: entry.name,
      url: `/audio/${encodeURIComponent(entry.name)}`,
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function serveAudio(request, response, fileName) {
  if (!isSafeAudioFileName(fileName)) {
    sendJson(response, 400, { error: "Invalid audio file name." });
    return;
  }

  const filePath = join(AUDIO_DIR, fileName);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    sendJson(response, 404, { error: "Audio file not found." });
    return;
  }
  if (!fileStat.isFile()) {
    sendJson(response, 404, { error: "Audio file not found." });
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypeFor(fileName),
    "Content-Length": fileStat.size,
  });
  createReadStream(filePath).pipe(response);
}

// A missing project file is the normal state of a fresh checkout, not an
// error, so it answers 200 with a null project. Returning 404 would make the
// browser log a failed request every time the app starts for the first time.
async function readProject(response) {
  let saved;
  try {
    saved = await readFile(PROJECT_FILE, "utf8");
  } catch {
    sendJson(response, 200, { project: null });
    return;
  }

  try {
    sendJson(response, 200, { project: JSON.parse(saved) });
  } catch {
    console.error(`Saved project is not valid JSON: ${PROJECT_FILE}`);
    sendJson(response, 200, { project: null });
  }
}

async function writeProject(request, response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_PROJECT_BYTES) {
      sendJson(response, 413, { error: "Project is too large." });
      request.destroy();
      return;
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  let project;
  try {
    project = JSON.parse(body);
  } catch {
    sendJson(response, 400, { error: "Body is not valid JSON." });
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  // Re-serialize with indentation so the saved file stays readable by hand,
  // matching the exported JSON format.
  await writeFile(PROJECT_FILE, JSON.stringify(project, null, 2), "utf8");
  sendJson(response, 200, { saved: true });
}

const server = createServer(async (request, response) => {
  // The URL is only used for its pathname; the host is irrelevant here.
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname;

  try {
    if (path === "/api/tracks" && request.method === "GET") {
      sendJson(response, 200, { tracks: await listAudioFiles() });
      return;
    }

    if (path.startsWith("/audio/") && request.method === "GET") {
      await serveAudio(
        request,
        response,
        decodeURIComponent(path.slice("/audio/".length)),
      );
      return;
    }

    if (path === "/api/project") {
      if (request.method === "GET") {
        await readProject(response);
        return;
      }
      if (request.method === "PUT") {
        await writeProject(request, response);
        return;
      }
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Server error." });
    }
  }
});

server.listen(PORT, () => {
  console.log(`NodeMix Canvas server listening on http://localhost:${PORT}`);
  console.log(`  audio folder: ${AUDIO_DIR}`);
  console.log(`  project file: ${PROJECT_FILE}`);
});
