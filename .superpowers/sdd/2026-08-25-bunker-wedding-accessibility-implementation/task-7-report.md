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

## Review fix round 1/5

Fix commit: `61573a3` (`Harden Bunker audio rearm lifecycle`).

### RED evidence

`npx vitest run src/features/bunker/BunkerScreenGuard.audio-lifecycle.test.tsx src/features/bunker/bunkerAudio.sample.test.ts` failed six new contracts before the fix and reported three unhandled rejected-play promises:

- Local projector mute did not stop active alarm, ambience, or finale samples and left them marked as playing.
- A finale missed because local audio was muted during the 1.6-second door/reveal delay was never requested, so explicit re-arm could not recover it.
- A blocked mission ambience arm was attempted again automatically after a mission → emergency → mission effect cycle.
- Rejected alarm, ambience, and finale sample promises remained pending and emitted unhandled rejections instead of becoming explicitly retryable.

### GREEN evidence

The Bunker audio controller now stops all sample sources immediately on local mute, invalidates pending play tokens while retaining requested alarm/ambience/finale intent, and resumes nothing when audio is merely unmuted. A missed finale is recorded as requested even while muted, and only `PROJECTOR_AUDIO_REARM_EVENT` retries it. All guarded sample promise rejections are handled and reset their cue to retryable idle.

ScreenGuard now retains mission-audio authorization for the run across emergency effect teardown. A blocked authorization remains blocked until explicit re-arm; an already authorized mission can resume after an interrupt without creating another authorization request.

- Focused guard/audio command — 25/25 passed with no unhandled errors.
- `npx vitest run src/features/bunker` — 97 files passed; 733 tests passed.
- `npm run typecheck` — passed.
- `npm run build` — passed, retaining only the existing large-chunk warning.
- `git diff --check` — passed.
