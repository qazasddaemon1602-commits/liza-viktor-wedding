# Task 7 report — Bunker audio lifecycle and finale sequencing

## Status

Implemented the Task 7 Bunker audio lifecycle boundary.

- Mission ambience is armed once per active mission lifecycle, is not restarted by narration or mission renders, and is stopped while the emergency alarm, Bunker-open reveal, or results scene owns audio.
- Alarm, ambience, and finale playback requests are idempotent while pending or playing. Failed autoplay attempts remain requested but retry only on the explicit projector audio re-arm event.
- ScreenGuard owns the complete door → reveal → finale sequence. The obsolete unlock-transition door playback and the reveal component's second audio owner were disconnected.
- Guarded async tokens prevent stale arm promises or delayed reveal timers from starting audio after results, restart, mute, or unmount.
- `BUNKER_OPEN` plays the door once, then the reveal and `bunker.finale` after the existing 1.6-second transition. `FINISHED`, a restarted run, mute, or unmount stops the finale.
- Existing narration once-per-run ID behavior, success cue behavior, UI states, RPC loading, and projector render paths remain unchanged.

## TDD evidence

The focused RED run failed five contracts before implementation: ambience overlapped the emergency alarm, the unlock transition consumed a duplicate door cue, blocked reveal audio played without re-arm, finale stop/start lifecycle was absent, and duplicate finale calls produced overlapping playback.

After implementation and the focused-test alignment, the Bunker lifecycle/audio tests pass.

## Verification

- `npx vitest run src/features/bunker` — 97 files passed; 727 tests passed.
- `npm run typecheck` — passed.
- `npm run build` — passed (`tsc --noEmit` and Vite production build).
- `git diff --check` — passed.
- Full `npm test` — 1,655 passed and 8 failed in two untouched guest-flow files. The same 8 failures reproduce when those files run alone: they still query the removed `ОТКРЫТЬ ТЕКУЩЕЕ ЗАДАНИЕ` button or an older confirmation dialog while the current guided mission UI is already open.

## Concerns

The repository-wide suite is not fully green because of the eight unrelated stale guest-flow expectations in `GuestHub.test.tsx` and `GuestJoinPage.test.tsx`; Task 7 does not touch those files or flows. The production build retains the existing large JavaScript chunk warning. The pre-existing untracked `artifacts/` directory remains untouched and excluded from the commit.
