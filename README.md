# NodeMix Canvas

A node-based music arrangement and DJ prototype.

Instead of a vertical playlist, users place tracks as nodes on a free-form canvas, connect them with transition edges, and play simple crossfades between connected tracks.

> **Status:** MVP complete (2026-07-12, Phases 0–10: canvas, node/edge editing including transition type and fade duration, JSON save/load, playback, crossfade). Audio is still an oscillator placeholder; real audio file import is the next phase. See `docs/12_implementation_log.md` and the 2026-07-12 entries in `docs/10_decision_log.md`.

---

## Concept

Most music tools organize tracks as a list. NodeMix Canvas treats music as a graph.

Each track is a node. Each connection is a transition. The canvas becomes a visual map of how tracks relate to each other — by mood, memory, genre, tempo, or personal association.

---

## MVP Features

- Track library panel showing available tracks
- Free-form canvas with track nodes
- Directed transition edges between nodes
- Simple playback: play a track, play a transition
- Crossfade using Web Audio API
- Project save and load as JSON

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React + TypeScript |
| Audio | Web Audio API |
| Storage | JSON (browser download / file picker) |
| Backend | None (frontend-only MVP) |

---

## Project Structure

```
src/
  domain/       — Track, TrackNode, TransitionEdge, Project types and mock data
  audio/        — Web Audio API engine
  components/   — React UI components
  storage/      — JSON export and import
  App.tsx
  main.tsx

docs/           — Design documents
docs/plans/     — Approved implementation plans
```

---

## Documentation

| File | Description |
|---|---|
| [docs/00_product_vision.md](docs/00_product_vision.md) | Product vision and principles |
| [docs/02_mvp_scope.md](docs/02_mvp_scope.md) | MVP feature scope and success criteria |
| [docs/04_domain_model.md](docs/04_domain_model.md) | Core domain types with TypeScript definitions |
| [docs/05_ui_requirements.md](docs/05_ui_requirements.md) | UI layout, interactions, and edge creation flow |
| [docs/06_audio_engine_requirements.md](docs/06_audio_engine_requirements.md) | Audio engine API and transition behavior |
| [docs/07_project_storage.md](docs/07_project_storage.md) | JSON save and load format |
| [docs/11_development_workflow.md](docs/11_development_workflow.md) | Development workflow for working with Claude Code |

---

## Development Workflow

This project uses a structured workflow with Claude Code:

1. **Explore** — read relevant docs and source files, summarize the current state
2. **Plan** — propose an implementation plan and wait for approval
3. **Code** — implement only the approved plan in small steps
4. **Review** — summarize what changed and how it was tested
5. **Commit** — use Conventional Commits style

See [docs/11_development_workflow.md](docs/11_development_workflow.md) for details.

---

## License

See [LICENSE](LICENSE).
