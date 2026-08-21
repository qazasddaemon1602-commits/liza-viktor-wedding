# Cinematic Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a cinematic, sound-on-by-default audio layer for the wedding site quickly, with a 12-second train carriage call and tactile sound on guest-phone interactions.

**Architecture:** Add one shared client audio service for generated UI cues, mute state, unlock handling, and priority suppression. Keep rich train/Bunker/MK moments as scene-level orchestration using local project-owned audio assets or generated fallbacks. Integrate globally for phone button feedback so every actionable control is covered without touching every component individually.

**Tech Stack:** React, TypeScript, Web Audio API, HTMLAudioElement, Vitest, Vite, Playwright smoke only when runner is available.

**Spec:** `docs/superpowers/specs/2026-08-20-cinematic-audio-system-design.md`

## Global Constraints

- Sound preference defaults ON; autoplay restrictions must never block event actions.
- Every actionable guest-phone button/choice gets restrained sound feedback after first interaction unlocks audio.
- `/screen` mute must silence site cues and existing premiere media behavior.
- Carriage call production duration is 12,000 ms and repeated calls must not overlap.
- Critical scene audio must be local/project-controlled; no copyrighted movie/game audio.
- Readiness is advisory only.
- Lean verification only: targeted audio/timing tests, typecheck, build, one browser smoke if runner is available.

---

### Task 1: Shared Site Audio Engine

**Files:**
- Create: `src/lib/siteAudio.ts`
- Test: `src/lib/siteAudio.test.ts`
- Modify: `src/app/App.tsx` or the top-level app shell used by guest routes

**Interfaces:**
- Produces: `siteAudio.arm()`, `siteAudio.setEnabled(boolean)`, `siteAudio.isEnabled()`, `siteAudio.play(cue)`, `siteAudio.beginPriority(level)`, `siteAudio.endPriority(level)`.
- Produces cue names: `tap | select | confirm | success | error | reveal | countdown | impact`.

- [ ] Write one focused test proving default enabled, explicit mute suppresses playback, and a low-priority tap is suppressed during a major scene.
- [ ] Implement the singleton WebAudio engine with safe no-op fallback and localStorage preference.
- [ ] Add one delegated capture listener at app level for actionable phone controls (`button`, submit controls, role=button, tappable answer controls) so ordinary taps get sound without per-component plumbing.
- [ ] Prevent double-fire by allowing explicit components to mark `data-audio-cue` and by rate-limiting repeated taps.
- [ ] Run only `vitest src/lib/siteAudio.test.ts`.

### Task 2: 12-Second Cinematic Carriage Call

**Files:**
- Modify: `src/features/screen/ScreenPage.tsx`
- Modify: `src/features/screen/CarriageCallScene.tsx`
- Modify or replace: `src/features/screen/screenAudio.ts`
- Test: existing screen/carriage-call test file or one new focused test next to the orchestration file
- Add local assets under `public/audio/train/` if binary upload is practical; otherwise use the shared engine's generated rail-rumble/horn fallback for the first production pass.

**Interfaces:**
- Production carriage-call duration: `12_000` ms.
- Scene audio sequence: station cue/rumble at start, horn around 2.5–5 s, fade/recede before scene exit.

- [ ] Write one focused timing test proving the call remains active for 12 seconds and a second call queues instead of overlapping.
- [ ] Change orchestration duration to 12 seconds.
- [ ] Add train-scene audio start/stop hooks tied to the carriage-call lifecycle and `/screen` mute state.
- [ ] Ensure a second call waits until the first scene finishes.
- [ ] Run only the focused carriage-call test.

### Task 3: Cinematic Semantic Cues in Key Flows

**Files:**
- Modify representative guest components for registration, Quiz, Bunker, Mortal Kombat, and Premiere only where a generic tap is not enough.

**Interfaces:**
- Generic global click = `tap`.
- Answer/choice = `select`.
- Submit/lock = `confirm`.
- Success/fragment/champion = `success` or `impact`.
- Error/retry = `error`.
- Reveal/results/dossier = `reveal`.

- [ ] Add `data-audio-cue` annotations or direct `siteAudio.play(...)` calls only at semantic moments: registration success/error, quiz select/results, bunker fragment/unlock/error, MK winner/champion, premiere standby/countdown controls.
- [ ] Keep premiere playback free of extra cues on the first beat; suppress ordinary UI sounds while the track is playing on `/screen`.
- [ ] Do not add a broad new component-test matrix; verify these interactions manually in browser after deployment.

### Task 4: Lean Verification and Publish

**Files:** no new feature files expected.

- [ ] Run targeted tests only: shared audio engine + carriage-call timing/queue.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] If GitHub runner is available, run one representative browser smoke covering `/screen` mute + carriage call + one guest-phone button sound/unlock path. If runner is unavailable, do not block release solely on that infrastructure failure.
- [ ] Update PR body from design-only to implementation summary.
- [ ] Merge after the above lean checks.
- [ ] Publish Lovable and verify the production site manually by ear/eye on one `/screen` and one phone before making any further tuning changes.

