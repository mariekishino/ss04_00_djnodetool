# Phase 14 Plan: Local Server Persistence

- Date: 2026-07-26
- Status: approved (discussed with Claude, 2026-07-26)
- Inputs: `docs/discussions/2026-07-26_phase12_13_and_persistence_options.md`
  (options A/B/C), `docs/10_decision_log.md` (2026-07-26 Phase 11 entry,
  decision 1: in-memory only), `docs/07_project_storage.md`

## Goal

Reopen the app and find the work still there: the project (nodes, edges,
transitions) loads automatically, and the tracks still have their audio.

Today both disappear on reload — audio because a browser's reference to a
picked file dies with the page, the project because it only ever lived in
React state unless the user exported a JSON file by hand.

## Chosen approach: a small local server (option C)

Audio files sit in a folder as ordinary files and are served over HTTP, so
`Track.audioUrl` — present in the domain model since day one and unused
ever since — finally means what it says. The project JSON is read and
written by the same server.

Rejected alternatives (see the discussion record for the full comparison):

- **A. IndexedDB**: copies the music into the browser's profile, where it
  is hard to inspect, back up or manage. Storage quotas apply.
- **B. File System Access API**: no copying, but effectively Chrome-only,
  and the handles still need IndexedDB to persist.

### Relationship to the frontend-only rule

`CLAUDE.md` says "frontend-only architecture **for MVP**" and "do not add
a backend unless explicitly requested". The MVP was declared complete on
2026-07-12 and this backend is explicitly requested, so the rule is not
being broken — but `CLAUDE.md` is updated in this phase so later sessions
are not misled.

The scope of the server is fixed and small: serve audio files, read/write
one project JSON. No authentication, no database, no upload endpoint, no
cloud sync.

## Decisions

1. **Audio files are placed in the folder by hand** (`audio/`). The app
   lists what is there; it does not upload. This removes multipart
   handling entirely.
2. **The project is saved on the server and the existing file
   Export/Import stays.** Server storage is the everyday path (auto-load
   at startup, explicit Save); the JSON file remains for backups and for
   moving a project elsewhere.
3. **The app still works with no server running**: it falls back to the
   mock project and the current session-only audio picker, with saving
   disabled. Starting the server is not a prerequisite for opening the UI.
4. **No dependencies and no build step for the server.** Plain JavaScript
   on Node's built-in `http` module, about a hundred lines. Adding Express
   would breach "no new major dependencies"; compiling TypeScript for the
   server would add a build step for very little code. The trade-off
   (server code is not type-checked) is accepted and recorded.

## Server

`server/index.js`, listening on port 5200. Vite proxies `/api` and
`/audio` to it, so the browser only ever talks to the Vite origin and no
CORS handling is needed.

| Route | Purpose |
|---|---|
| `GET /api/tracks` | list the audio files in `audio/` as `{ fileName, url }` |
| `GET /audio/<file>` | serve one audio file with a correct content type |
| `GET /api/project` | the saved project, or 404 when none is saved yet |
| `PUT /api/project` | save the request body as the project |

Path safety: a requested file name must be a plain name inside `audio/` —
no separators, no `..`. This is a pure function (`isSafeAudioFileName`) so
it can be unit tested.

Saved project location: `data/project.json`. Both `audio/` and `data/` are
git-ignored: they hold the user's music and their working project, not
source.

## Frontend

1. `src/storage/serverStorage.ts` — `fetchServerTracks`,
   `fetchServerProject`, `saveServerProject`. Every call resolves to a
   "server unavailable" result instead of throwing, so decision 3 is
   handled in one place.
2. Startup: try the server's project; fall back to `mockProject`. Then
   load audio for every track that has an `audioUrl`.
3. `AudioEngine.loadTrackAudioFromUrl(trackId, url)` — fetch, decode,
   store. It shares the decode step with the existing file import; the
   only difference is where the bytes come from.
4. Track Library: with the server up, a track shows a picker of the files
   in `audio/`; choosing one sets `audioUrl` and loads the audio. With the
   server down, the existing "Load audio" file picker is shown instead.
5. Toolbar: a "Save" button writes the project to the server (disabled
   when unavailable). "Export JSON" / "Import JSON" are unchanged.

Decoding at startup needs an AudioContext but no sound, so the engine
gains a way to obtain the context without resuming it — creating a
suspended context outside a user gesture is allowed; resuming it is not.

## Out of scope

- Uploading audio through the UI.
- Multiple saved projects (one `data/project.json`).
- Auto-save (saving is explicit).
- Serving the built frontend from the same server (Vite still serves it).
- Range requests / streaming seek support: whole files are served.

## File changes

| File | Change |
|---|---|
| `server/index.js` | new: the HTTP server |
| `server/paths.js` (+ test) | new: pure path/content-type helpers |
| `vite.config.ts` | proxy `/api` and `/audio` to port 5200 |
| `package.json` | `npm run server` |
| `.gitignore` | ignore `audio/` and `data/` |
| `src/storage/serverStorage.ts` (+ test) | new: server calls, unavailable-safe |
| `src/audio/audioEngine.ts` | load audio from a URL; context without resume |
| `src/components/TrackLibrary.tsx` | server file picker, local picker fallback |
| `src/components/ProjectToolbar.tsx` | Save button |
| `src/App.tsx` | startup load, save handler, server availability state |
| `CLAUDE.md` | record that a local server now exists and its fixed scope |

## Trade-offs accepted

- Two processes to run in development (Vite and the server).
- The server is plain JS, so it is not type-checked.
- One project per checkout; naming/選択 of projects is future work.
- Audio is served whole, so seeking within a long track will download it
  fully first (no impact on today's playback, which starts from 0).

## Testing

- Unit: `isSafeAudioFileName` (plain name, traversal, separators, empty),
  content-type mapping, and `serverStorage`'s unavailable handling with a
  stubbed `fetch`.
- Browser (verify skill): with the server running and a WAV in `audio/`,
  attach it to a track, save, reload, and confirm the project and its
  audio come back and play. Then stop the server and confirm the app still
  opens on mock data with saving disabled. No console errors.
