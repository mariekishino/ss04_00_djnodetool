# Phase 20 Plan: Transition Positions (Step 3, stage ① — window, positions, volume)

- Date: 2026-10-26
- Status: approved (discussed with Claude, 2026-10-26; the three UI
  decisions under "Decisions that need an explicit yes" were accepted by
  the developer the same day)
- Inputs: `docs/discussions/2026-10-08_transition_design_spotify_reference.md`,
  `docs/discussions/2026-10-26_timber_timbre_reference.md`,
  `docs/discussions/2026-08-17_feedback_after_using.md` (items 3, 6, 7),
  `docs/discussions/2026-08-17_open_issue_next_deck_selection.md`,
  `docs/plans/phase17_seek_by_click.md`
- Position: step 3 of 4 towards choosing transition points by eye
  (steps 1 and 2, the deck panel and seek, are done; step 4 is automatic
  BPM). Step 3 is split into five stages, agreed on 2026-10-26:
  ① window, positions, volume — this phase;
  ② tempo matching; ③ filter and EQ; ④ effects; ⑤ looping.
  Stages ② to ⑤ are not part of this phase.

## Goal

The user can say, for one connection, "leave track A here, and come into
track B there", see both points on the deck waveforms, and hear exactly
that hand-over without waiting for A to end.

Today a transition always leaves A `fadeDurationSec` before its end and
always enters B at its start. Feedback item 6 asked for a choice of place;
item 3 noted that with a four-minute track there is no practical way to
hear a transition at all.

## How the Spotify structure maps onto our data

The 2026-10-08 discussion read Spotify's screen as: one transition window,
A's position in it, B's position in it, and one named curve per item
(volume, EQ, ...). Our `TransitionEdge` already holds two of the four:

| Spotify | NodeMix Canvas today | This phase |
|---|---|---|
| window length | `fadeDurationSec` | unchanged |
| volume curve | `transitionType` (cut / fade / crossfade are 3 of Spotify's 10) | unchanged; more curves are a later stage |
| A's position | fixed: end minus fade | new `exitAtSec` |
| B's position | fixed: 0 | new `enterAtSec` |

So stage ① adds two optional numbers and renames nothing. The 2026-10-08
record expected the type/fade fields to be re-derived from a curve name and
a window, which would have needed an old-JSON migration and put Phase 19
first. Keeping the two existing fields as they are removes that migration;
the generalisation to named curves can still happen in stage ③ when a
second parameter (filter cutoff) actually needs it. This is a deliberate
deviation from the 2026-10-08 "Phase 19 first" ordering, recorded here.

## Decisions

1. **Positions live on the edge, as seconds into each track.**

   ```ts
   export type TransitionEdge = {
     // ...existing fields unchanged...
     exitAtSec?: number;   // position in the FROM track where the window starts
     enterAtSec?: number;  // position in the TO track that plays at window start
   };
   ```

   Both are optional. `undefined` means "the old behaviour": exit at
   `duration − fade` (or at the end for `cut`), enter at 0. Every existing
   project JSON therefore loads and plays exactly as before. Seconds, not
   beats: beats need a first-beat position per track, which is stage ⑤'s
   prerequisite and not in the data yet.

2. **What the window means for each type.** With `exit = exitAtSec`,
   `enter = enterAtSec`, `fade = fadeDurationSec`:

   - `cut`: at `exit`, A stops and B starts from `enter`.
   - `fade`: from `exit`, A fades to silence over `fade`; then B starts
     from `enter`.
   - `crossfade`: at `exit`, B starts from `enter`; A goes to 0 and B to
     full over `fade`, together.

   This is the current behaviour with the two fixed points made movable.

3. **Pure rules in the domain, durations passed in.** `edgeRules.ts` gains
   `changeExitPosition(edge, seconds, fromDurationSec)` and
   `changeEnterPosition(edge, seconds, toDurationSec)`: non-finite → unset,
   otherwise clamped to `[0, duration]`. The duration is a parameter (like
   node size in `nodeLayout.ts`) because `Track.durationSec` is not yet
   reliably saved (Phase 19) — at edit time the decoded buffer's length is
   known and passed down. `transitionTiming.ts` gains
   `resolveTransitionPoints(edge, fromDurationSec)` returning concrete
   `{ exitAtSec, enterAtSec }` with the defaults applied; it replaces the
   rule inside `transitionTriggerOffset`.

4. **The Inspector edits the numbers; the decks show them.** The edge view
   gets two number inputs, "Exit A at" and "Enter B at" (seconds, with a
   "default" placeholder when unset and a small "reset" affordance). When an
   edge is selected, the deck panel shows the edge's FROM node on NOW and
   its TO node on NEXT, each waveform with a marker line at its point and
   the window shaded after it (on NOW) and before/after it (on NEXT).

5. **Clicking a deck waveform while an edge is selected sets the point.**
   NOW click → `exitAtSec`; NEXT click → `enterAtSec`. With a node
   selected, a click still seeks (Phase 17, unchanged). The deck stays
   presentational: it keeps reporting a 0..1 ratio, and App decides whether
   that ratio is a seek or a position edit from what is selected.

6. **"Play transition" previews from just before the exit point.** It
   starts A at `max(0, exit − 5 s)`, hands over at `exit` by the edge's
   type, and B enters at `enter`. Five seconds of lead-in is a constant,
   not a setting. This is the "a way to actually hear it" that feedback
   item 3 was missing. Stop works as before.

7. **Sequential playback ("Play from here") honours the points.** The
   hand-over timer fires at `exit` instead of `duration − fade`, and the
   next node starts at `enter` (`startVoice` already takes an offset since
   Phase 17). Progress reporting backdates the start by `enter` so the NOW
   deck's playhead reads the true position, as seek already does.

8. **One control function in the engine.** The three ramp helpers and the
   duplicated cut/fade/crossfade switch in `playTransition` /
   `transitionToNode` collapse into one private `handOver(now, edge,
   targetNode, enterAtSec)` and one `rampTo(param, value, startAt,
   seconds)`. This is the refactor marked in the 2026-10-26 learning note
   (section 4, item 1): the gain ramp becomes "a value driving an
   AudioParam", which stage ③ will reuse for a filter cutoff. Behaviour is
   unchanged by the refactor itself; it is done here because this phase
   touches every one of those lines anyway.

### Decisions that need an explicit yes

The 2026-08-17 open-issue record asks that UI behaviour rules be agreed
before implementation. These three change what the user sees:

- (4) **NEXT deck shows the selected edge's target.** This settles the
  NEXT-deck rule only for the edge-selected case, in the direction the
  2026-10-08 record called "natural". With a node selected the Phase 16
  rule (first outgoing edge) stays, and branch choice remains open.
- (5) **Waveform click changes meaning with the selection.** Seek when a
  node is selected; set a point when an edge is selected. The alternative
  (a modifier key, or a "set here" button next to each deck) is a
  fallback if this feels surprising in use.
- (6) **5-second lead-in for the preview**, fixed.

## Scope

1. `src/domain/types.ts`: the two optional fields, with comments.
2. `src/domain/edgeRules.ts` (+ tests): `changeExitPosition`,
   `changeEnterPosition`.
3. `src/audio/transitionTiming.ts` (+ tests): `resolveTransitionPoints`;
   `transitionTriggerOffset` becomes a thin wrapper or is removed.
4. `src/audio/audioEngine.ts`: `rampTo`, `handOver`; `playTransition` gains
   the lead-in; `transitionToNode` takes `enterAtSec`; progress backdating.
5. `src/audio/sequencePlayer.ts`: schedule from the resolved exit point,
   pass `enterAtSec` on advance.
6. `src/components/InspectorPanel.tsx`: two inputs + reset, callbacks only.
7. `src/components/DeckPanel.tsx`: marker and window shading from props
   (`markerRatio`, `windowRatio`); no new state; the click keeps reporting
   a ratio.
8. `src/App.tsx`: when an edge is selected, deck NOW/NEXT come from the
   edge; route the deck click to seek or position edit; the two new edge
   handlers; `Play transition` wiring.
9. `src/index.css`: marker line and window shading.
10. `docs/04_domain_model.md`, `docs/05_ui_requirements.md`: the two fields
    and the click rule, after implementation.

## Out of scope

- Stage ② tempo matching (the "compute speed at the join from both BPMs"
  proposal of 2026-10-08 §4.5 is still awaiting the developer's answer;
  it is decided in stage ②'s plan, not here).
- Stages ③–⑤: filter/EQ, effects, looping; more than three volume curves;
  presets.
- Beat units, first-beat positions, Camelot key logic.
- Dragging the waveform to shift positions (Spotify's gesture). Click and
  number input are enough to prove the idea; dragging can be added later
  without changing the data.
- Branch choice on the NEXT deck when a node has several outgoing edges.
- Phase 19 (server as source of truth, autosave, API naming) — independent
  of this phase now that no migration is needed.
- Persisting `Track.durationSec` (Phase 19); this phase clamps against the
  decoded buffer at edit and play time instead.

## Trade-offs accepted

- Seconds, not beats, so a window set by ear can drift against the beat
  grid. Stage ⑤ is where beats enter; the data can gain a beat-based field
  then without breaking this one.
- An `exitAtSec` beyond the track's real length (e.g. after swapping the
  audio file) is clamped at play time, silently, rather than flagged in
  the UI. The 2026-07-12 policy of "no silent 'natural' substitutions"
  still holds for the *fade length*; for a position, clamping to the end
  is the only sensible reading.
- Keeping `transitionType` + `fadeDurationSec` means stage ③ will still
  have to generalise the curve field. The cost is deferred, not avoided.
- The waveform click rule (decision 5) overloads one gesture. If it proves
  confusing, the fallback costs two buttons and no data change.

## Testing

- Unit: `changeExitPosition` / `changeEnterPosition` (unset on NaN, clamp
  below 0 and above duration, unchanged edge identity);
  `resolveTransitionPoints` (defaults per type with fields unset, explicit
  values pass through, clamp against duration).
- Unit: the deck marker/window ratio helper, if extracted.
- Existing tests for `transitionTriggerOffset` are updated or moved.
- Browser (verify skill): select an edge → NOW/NEXT show its two nodes;
  click NOW waveform → Inspector "Exit A at" updates and a marker appears;
  click NEXT waveform → "Enter B at" updates; Play transition → audio
  starts, hand-over happens within ~5 s, Stop works; select a node → click
  seeks as before; export JSON → the two fields are present only on the
  edited edge; import a pre-Phase-20 JSON → plays as before; no console
  errors. Audible correctness is left to the developer's manual check.
