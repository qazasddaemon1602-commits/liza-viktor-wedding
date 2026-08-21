# Bunker V2 Unknown Passenger and Final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать сюжетное раскрытие «Неизвестного пассажира», пять финальных параметров, server-authoritative timer, открытие Бункера и итоговую статистику.

**Architecture:** Unknown Passenger — отдельный V2 global instance с идемпотентными milestones. Final собирает нормализованные parameters с primary/fallback/bonus источниками и никогда не образует dead end.

**Tech Stack:** Supabase/PostgreSQL, pgTAP, React/TypeScript, Vitest, recorded sample audio.

**Spec:** `docs/superpowers/specs/2026-08-21-bunker-connected-game-v2-design.md`

## Global Constraints

- Требует завершённые M01–M06 packages.
- Unknown Passenger не является задачей и не имеет «правильного» ответа.
- Final values: `57°09 / 65°32`, `04`, `4719`, `23:40`, `LV0830`.
- Final duration: `1800 + clamp(sum(route_bonus_minutes)*60,-300,600)`.
- Owner emergency completion требует причины и отображается в статистике.

---

### Task 1: Unknown Passenger milestones and facts

**Files:**
- Create via CLI: migration from `npx supabase migration new bunker_v2_story_final`
- Create: `supabase/tests/bunker_v2_story_final.sql`
- Create: `src/features/bunker/v2/unknownPassenger.service.ts`
- Create: `src/features/bunker/v2/unknownPassenger.service.test.ts`

- [ ] Write RED tests for `no_prior_match`, wagon BK-17 comparison, only assigned bunker-memory owner, duplicate commands, 12/37/61/84 milestones, 60-second action window and owner force reason.
- [ ] Implement server-owned recovery sequence and `scene_completed`; no browser progress increment.
- [ ] Create/reconcile facts: `unknown_passenger_found`, `bunker_revealed`, `bk17_confirmed`, `sector4_bunker_entry`, `code4719_confirmed`.
- [ ] Permit transition only after completion receipt or audited force outcome.
- [ ] Run SQL/service tests; commit `feat: implement unknown passenger story`.

### Task 2: Unknown Passenger phone/TV/admin scene

**Files:**
- Create: `src/features/bunker/v2/UnknownPassengerPlayer.tsx`
- Create: `src/features/bunker/v2/UnknownPassengerPlayer.test.tsx`
- Create: `src/features/bunker/v2/UnknownPassengerScreen.tsx`
- Create: `src/features/bunker/v2/UnknownPassengerScreen.test.tsx`
- Create: `src/features/admin/bunker/UnknownPassengerOwnerPanel.tsx`
- Modify: `src/features/bunker/bunkerAudio.ts`
- Modify: `src/lib/audioManifest.ts`

- [ ] Write RED tests for exact narrative order, optional BK-17 compare, personal memory using registered name, no timer/right-answer UI and reconnect at each milestone.
- [ ] Implement TV disturbance/recovery scene with reduced-motion static alternative and safe-area text.
- [ ] Integrate existing archive/card/map assets; generate only missing real raster assets after measuring slots.
- [ ] Add a real recorded interference cue with attribution/hash if no current cue matches; audio is optional and has text equivalent.
- [ ] Run UI/audio tests; commit `feat: add unknown passenger presentation`.

### Task 3: Final parameters and bounded timer

**Files:**
- Continue generated migration.
- Modify: `supabase/tests/bunker_v2_story_final.sql`
- Create: `src/features/bunker/v2/final.service.ts`
- Create: `src/features/bunker/v2/final.service.test.ts`

- [ ] Write RED tests for exact five values, normalization, all primary sources, fallback timestamps 12:00/10:00/08:00/06:00/04:00/01:00, optional ability hints, and duration bounds 1500–2400 seconds.
- [ ] Implement final start snapshot: store base, bonus, duration, parameter sources and deadlines once.
- [ ] Implement parameter confirmation without exposing validator; wrong attempts remain retryable and are rate-limited/audited.
- [ ] Implement atomic `request_access`, exact retry, stale version and emergency owner open.
- [ ] Run tests; commit `feat: implement bunker final terminal`.

### Task 4: Final phone, TV and owner experience

**Files:**
- Create: `src/features/bunker/v2/FinalPlayer.tsx`
- Create: `src/features/bunker/v2/FinalPlayer.test.tsx`
- Create: `src/features/bunker/v2/FinalScreen.tsx`
- Create: `src/features/bunker/v2/FinalScreen.test.tsx`
- Create: `src/features/admin/bunker/FinalOwnerPanel.tsx`
- Create: `src/features/bunker/v2/BunkerResults.tsx`
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`

- [ ] Write RED tests for five parameter fields, server timer, fallback reveal, one dominant CTA, locked/approved TV, owner reason confirmation and summary statistics.
- [ ] Implement accessible terminal and separate TV validation sequence; no secret value in DOM before resolved.
- [ ] Implement final result: duration, wagon contribution, roles used, resources, hints, errors and owner overrides.
- [ ] Verify at 390×844 and 1920×1080 semantics; commit `feat: add bunker final experience`.

### Task 5: Story/final gate

- [ ] Run all story/final Vitest + pgTAP.
- [ ] Run typecheck, build, diff check and audio hash/attribution tests.
- [ ] Obtain spec and quality/security reviews, fix through original implementers, commit `chore: verify bunker story and final`.

