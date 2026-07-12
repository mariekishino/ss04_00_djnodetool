---
name: verify
description: Build, launch, and drive NodeMix Canvas in a real browser to verify a change end-to-end.
---

# Verifying NodeMix Canvas

Frontend-only Vite + React app. No test-only shortcuts: verify by driving
the real UI in a browser.

## Build / launch

```bash
npm run dev -- --port 5199   # dev server (background it; logs to stdout)
curl -s http://localhost:5199/ | head   # confirm it serves
```

`npm run build` / `lint` / `test` exist but are CI checks, not verification.

## Browser handle

No browser is preinstalled in this VM. Working recipe (once per VM):

```bash
cd <scratchpad> && npm init -y && npm install playwright-core
npx playwright-core install --with-deps chromium   # ~115MB, cached in ~/.cache/ms-playwright
```

Then drive with a small `playwright-core` Node script (`chromium.launch()`,
default headless). Capture screenshots per step and collect `console`
errors + `pageerror`.

## Useful selectors / flows

- Mock project loads with 2 tracks, 2 nodes, 1 edge — no setup needed.
- Select an edge: `.edge-hit` (wide transparent hit line over `.edge-line`).
- Inspector edge controls: `#edge-transition-type` (select),
  `#edge-fade-duration` (number input).
- Player status text: `.player-status`; buttons by role/name
  (`Play transition`, `Stop`).
- Click empty canvas (e.g. svg at 30,30) to deselect.

## Gotchas

- This VM has no audio output — verify playback via absence of console
  errors and UI state, and say so; audible checks are the user's.
- The dev server keeps running; `pkill -f "vite.*5199"` when done
  (exit code 144 is normal).
