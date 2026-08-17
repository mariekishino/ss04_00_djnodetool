# CLAUDE.md

## Project

This project is called NodeMix Canvas.

It is a node-based music arrangement and DJ prototype.

The goal is to let users place tracks on a free-form canvas, connect them with transition edges, and play simple transitions between connected tracks.

## Important Instruction

Before writing code, always read the files in the `docs/` directory.

Start with:

- `docs/00_product_vision.md`
- `docs/02_mvp_scope.md`
- `docs/04_domain_model.md`
- `docs/06_audio_engine_requirements.md`

Some docs may contain only TODO placeholders. Treat those as intentionally unfinished.

For now, use these files as the source of truth:

- `docs/00_product_vision.md`
- `docs/02_mvp_scope.md`
- `docs/04_domain_model.md`
- `docs/06_audio_engine_requirements.md`
- `CLAUDE.md`

Do not invent requirements from unfinished TODO files.

After reading the docs, summarize your understanding before making major implementation changes.

## Development Philosophy

Prioritize:

- small steps
- readable code
- clear architecture
- understandable implementation
- explicit data structures
- maintainability
- learning value

Do not prioritize:

- feature quantity
- visual polish too early
- unnecessary libraries
- premature backend work
- complex AI behavior
- streaming service integration

## Technical Direction

Use:

- React
- TypeScript
- local mock data
- local JSON save/load
- Web Audio API for simple playback

The MVP was frontend-only. Since Phase 14 (2026-07-26) there is also a small
local server in `server/`, added at the developer's explicit request to make
audio files and the project survive a reload.

Its scope is fixed and must not grow without a new explicit request:

- serve audio files from the git-ignored `audio/` folder
- read and write one project JSON in the git-ignored `data/` folder

No authentication, no database, no upload endpoint, no cloud sync. It is
plain JavaScript on Node's built-in modules: no dependencies, no build step.
Run it with `npm run server` alongside `npm run dev`; Vite proxies `/api` and
`/audio` to it. The app must keep working when the server is not running.

Do not add any other backend unless explicitly requested.

## Suggested Directory Structure

```txt
src/
  domain/
    types.ts
    mockProject.ts

  audio/
    audioEngine.ts

  components/
    TrackLibrary.tsx
    NodeCanvas.tsx
    TrackNode.tsx
    EdgeView.tsx
    PlayerControls.tsx
    InspectorPanel.tsx

  storage/
    projectStorage.ts

  App.tsx
  main.tsx

server/
  index.js          # the local server (Phase 14)
```

This structure can be adjusted, but do not mix all logic into one large file.

## Architecture Rules

### Domain

Domain types should live in:

```txt
src/domain/
```

The domain model should not depend on React.

Core domain entities:

- Track
- TrackNode
- TransitionEdge
- Project

### UI

UI components should live in:

```txt
src/components/
```

React components should be small and focused.

Avoid putting audio engine logic directly inside UI components.

### Audio

Audio logic should live in:

```txt
src/audio/
```

Use Web Audio API only for simple playback and crossfade in the MVP.

Create one `AudioEngine` instance at the app level and pass it to components through props.
Do not use React Context for the audio engine unless prop drilling becomes unmanageable.

### Storage

Project save/load logic should live in:

```txt
src/storage/
```

Project data should be serializable as JSON.

## MVP Features

Build only these features first:

- Track library
- Canvas display
- Track nodes
- Transition edges
- Node selection
- Simple project JSON save/load
- Simple playback
- Simple crossfade

## Out of Scope for MVP

Do not implement these unless explicitly requested:

- Spotify integration
- Suno integration
- Apple Music integration
- YouTube integration
- backend server
- authentication
- cloud sync
- database
- AI editing
- natural language editing
- BPM auto-detection
- beat matching
- pitch shifting
- time stretching
- waveform editor
- social sharing
- payment features
- mobile app

## Documentation Priority

Use the following priority when reading project documentation:

1. `CLAUDE.md`
2. Product and implementation docs under `docs/`
3. Approved implementation plans under `docs/plans/`
4. Decision logs

Files under `docs/learning/` are personal learning notes for the human developer.

Do not treat `docs/learning/` as product requirements, implementation requirements, or source-of-truth documentation.

Only read or refer to `docs/learning/` when explicitly asked to explain concepts, summarize learning notes, or help the human developer study.

## Implementation Rules

When asked to implement something:

1. State what you will change.
2. Keep the change small.
3. Do not modify unrelated files.
4. Do not add features outside the request.
5. Explain the changed files after implementation.
6. Mention any trade-offs or shortcuts.

## Pull Request Description Rules

When creating a pull request description, always include a `User Prompt` section.

The `User Prompt` section should summarize the user's original request that led to the change.

Rules:

* Consolidate requests across multiple conversation turns when needed.
* Preserve the user's intent accurately.
* Do not add requirements that the user did not ask for.
* Do not include unnecessary chat logs, emotional context, or unrelated discussion.
* Do not include sensitive personal information unless it is directly necessary for the implementation.
* If there are multiple distinct requests, list them as bullet points.
* If the implementation intentionally does not cover part of the request, mention that in the PR description.

Recommended PR description structure:

```md
## User Prompt

- Summarize the user's request here.

## Summary

- Summarize what changed in this PR.

## Changes

- List the main files or features changed.

## Out of Scope

- List anything intentionally not implemented.

## Testing

- Describe how the change was tested.
```


## Code Quality Rules

- Use TypeScript types.
- Avoid `any` unless there is a clear reason.
- Avoid large components.
- Separate domain logic from UI logic.
- Keep functions small.
- Prefer explicit names.
- Do not hide important behavior in unclear helper functions.
- Add comments only when they explain non-obvious behavior.

## AI Behavior Rules

Do not make large architectural changes without explaining them first.

Do not replace the project structure without permission.

Do not add new major dependencies without explaining why.

Do not implement future features just because they seem useful.

If the request is ambiguous, choose the smallest reasonable implementation and explain the assumption.

## First Implementation Order

Follow this order unless instructed otherwise:

1. Create domain types.
2. Create mock project data.
3. Render a static track library.
4. Render a static canvas.
5. Render nodes from mock data.
6. Render edges from mock data.
7. Add node selection.
8. Add "Add to Canvas" button in the Track Library.
9. Add edge creation using the MVP connection flow: select source node → click "Start Connection" → click target node.
10. Add drag to reposition nodes on the canvas.
11. Add project JSON export/import.
12. Add simple audio playback.
13. Add crossfade using TransitionEdge.

Note: drag-and-drop from Track Library to canvas is not part of the MVP (planned for v0.3 or later).

## Definition of Done for MVP

The MVP is complete when:

- A user can see tracks in a library.
- A user can see tracks as nodes on a canvas.
- A user can connect nodes.
- A user can define a simple transition.
- A user can play a basic transition.
- A user can save and load the project as JSON.
- The code structure is understandable.