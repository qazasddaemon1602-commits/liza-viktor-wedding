# Bunker V2 Experience and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Объединить V2 в понятный мобильный кабинет, отдельные TV-сцены, безопасный owner-таймлайн и воспроизводимый Test Mode с полным release gate.

**Architecture:** Shared QuestionLayout исправляет Quiz и Bunker. Event queue управляет P0–P3 и восстановлением контекста. TV registry выбирает одну V2 scene по authoritative state. Owner schedule хранится сервером; simulator создаёт изолированный test_run.

**Tech Stack:** React 19, TypeScript 7, CSS, Vitest, Playwright 1.62, Supabase/pgTAP, local raster/audio assets.

**Spec:** `docs/superpowers/specs/2026-08-21-bunker-connected-game-v2-design.md`

## Global Constraints

- Человекочитаемый русский текст; raw enum/item key/UUID — только диагностика.
- Mobile targets: 320, 390, 430, 768 and 844×390; touch target ≥44 px.
- TV targets: 1366×768, 1920×1080, 4K; safe area ≥5%.
- Reduced motion и выключенный звук сохраняют весь смысл.
- Вопрос и один CTA видны в первом 390×844 viewport даже с изображением.
- Test Mode не использует production device keys и удаляется по `test_run_id`.

---

### Task 1: Shared QuestionLayout for Quiz and Bunker

**Files:**
- Create: `src/components/QuestionLayout.tsx`
- Create: `src/components/QuestionLayout.test.tsx`
- Create: `src/styles/question-layout.css`
- Modify: `src/features/quiz/GuestLiveQuizCard.tsx`
- Modify: `src/features/quiz/GuestQuizPage.tsx`
- Modify: V2 mission player components.

- [ ] Write RED tests for semantic order `header → title → question → preview → CTA`, title ≤2 rendered lines, question ≤4 and media height formula.
- [ ] Implement `QuestionLayout` with `mediaHeight=min(180px,(viewport-32)*9/16)`, accessible viewer and preserved answer state.
- [ ] Add Playwright geometry assertion at 390×844: full question and one CTA inside viewport; test long real name and maximal timer.
- [ ] Run Quiz/Bunker focused tests; commit `fix: keep live questions above media`.

### Task 2: Mobile dashboard, event queue and inventory

**Files:**
- Create: `src/features/guest/liveEventQueue.ts`
- Create: `src/features/guest/liveEventQueue.test.ts`
- Create: `src/features/guest/GuestLiveEventLayer.tsx`
- Create: `src/features/guest/GuestLiveEventLayer.test.tsx`
- Modify: `src/features/guest/GuestHub.tsx`
- Modify: `src/features/guest/GuestLiveActivity.tsx`
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/styles/guest-hub.css`

- [ ] Write RED queue tests: P0 preempts, P1 version becomes read-only, P2 coalesces, P3 never steals focus, reconnect reads receipt first.
- [ ] Implement saved `returnSurface`, tab, scroll, draft, instance/version and focus restoration contract.
- [ ] Replace raw Bunker tabs/keys with Russian labels and real item cards; empty inventory remains visible before start.
- [ ] Test 320/390/430/768, landscape, long names, keyboard, inert background and Escape policy.
- [ ] Commit `feat: unify guest live event experience`.

### Task 3: TV scene registry, audio readiness and layouts

**Files:**
- Create: `src/features/bunker/v2/screenSceneRegistry.ts`
- Create: `src/features/bunker/v2/screenSceneRegistry.test.ts`
- Create: `src/features/bunker/v2/BunkerV2Screen.tsx`
- Create: `src/features/bunker/v2/BunkerV2Screen.test.tsx`
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`
- Modify: `src/features/bunker/bunkerAudio.ts`
- Modify: `src/styles/bunker.css`

- [ ] Write RED mapping test for every V2 state; assert no `mission_a/mission_b` mapping.
- [ ] Implement N=2 columns, N=3 columns, N=4 2×2, N=5 centered 3+2 with exact font minima/safe area.
- [ ] Gate scene start on asset/audio prepare with bounded timeout and visual fallback; reconnect never replays past one-shot cue.
- [ ] Add reduced-motion and aria-live threshold tests; commit `feat: add bunker v2 screen registry`.

### Task 4: Owner schedule, timeline and safe controls

**Files:**
- Create via CLI: migration from `npx supabase migration new bunker_v2_schedule`
- Create: `supabase/tests/bunker_v2_schedule.sql`
- Create: `src/features/admin/bunker/BunkerSchedule.tsx`
- Create: `src/features/admin/bunker/BunkerSchedule.test.tsx`
- Create: `src/features/admin/bunker/BunkerTimeline.tsx`
- Create: `src/features/admin/bunker/BunkerTimeline.test.tsx`
- Modify: `src/features/admin/bunker/AdminBunkerControl.tsx`
- Modify: `src/styles/admin.css`

- [ ] Write RED SQL/UI tests for exact planned duration, actual start, delay, remaining-plan recalculation and final planned-finish audit update.
- [ ] Implement owner schedule persistence and read projection; ranges are editor defaults, saved values are exact seconds.
- [ ] Implement `Сейчас`, `Следующее действие`, TV health, wagon progress, audio readiness and reverse-chronological timeline.
- [ ] Require reason + second confirmation for restart/stop/manual open/force outcome; commit `feat: add bunker owner timeline`.

### Task 5: Test Mode simulator

**Files:**
- Create via CLI: migration from `npx supabase migration new bunker_v2_test_mode`
- Create: `supabase/tests/bunker_v2_test_mode.sql`
- Create: `src/features/admin/bunker/BunkerTestMode.tsx`
- Create: `src/features/admin/bunker/BunkerTestMode.test.tsx`
- Create: `tests/e2e/bunker-v2-simulator.spec.ts`

- [ ] Write RED security tests proving only owner can create/delete `is_test=true` guests and production rows are untouched.
- [ ] Implement `owner_create_bunker_test_run(event_id,count,seed)` for N=15–40 and `owner_delete_bunker_test_run(test_run_id)`.
- [ ] Implement deterministic action driver with success/error mix, accelerated deadlines only inside test run and no external notifications.
- [ ] Add E2E loop for N=15,16,17,23,32,39,40 plus seeded full run for every N=15…40.
- [ ] Commit `test: add bunker v2 scenario simulator`.

### Task 6: Final visual, resilience and release gate

**Files:**
- Create: `tests/e2e/bunker-v2-mobile.spec.ts`
- Create: `tests/e2e/bunker-v2-screen.spec.ts`
- Create: `src/features/visual/bunkerV2AssetContract.test.ts`
- Modify: `public/audio/ATTRIBUTION.md` only for newly approved recordings.

- [ ] Capture/compare 320×844, 390×844, 430×932, 844×390, 1366×768, 1920×1080, 3840×2160 and reduced-motion states.
- [ ] Exercise reload phone/TV each stage, late guest, Realtime loss, concurrent last-item use, double trade accept and excluded-player continuation.
- [ ] Run full `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`, full pgTAP and Playwright.
- [ ] Apply migrations to the authorized target, run rollback-only authenticated/guest probes and Supabase advisors; no ERROR/new security warning.
- [ ] Perform production-like rehearsal, remove `test_run_id`, verify wedding data preserved, request final two-stage review.
- [ ] Commit `chore: verify bunker v2 release` and only then prepare push/Lovable sync handoff.

