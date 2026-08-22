# Final Event Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the host, Bunker, accessibility, narration and quiz-media experience and release it to Lovable through GitHub only.

**Architecture:** Extend the existing React/Supabase contracts with owner read-model convergence, explicit guest actions and an operational host runbook. Keep visual work inside the established editorial/railway design language and make all media project-local.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase/Postgres/pgTAP, GitHub Actions, built-in ImageGen, browser `speechSynthesis`.

**Spec:** `docs/superpowers/specs/2026-08-23-final-event-experience-design.md`

## Global Constraints

- Start from `origin/main` at `0946022` and preserve user wow-polish commit `b158e61`.
- Deliver to Lovable only by GitHub synchronization; never edit in Lovable.
- Use TDD for every production change and keep migrations idempotent for the production event.
- Preserve the current editorial railway design system, existing generated assets and current routes.
- Generate all 30 quiz images as separate raster assets; do not crop a contact sheet or use placeholders.
- Narration must be free, optional, non-blocking and require prior audio arming.
- Do not merge or apply production migrations until the exact tested head is green.

---

### Task 1: Owner live Bunker convergence

**Files:**
- Modify: `src/features/admin/bunker/AdminBunkerControl.tsx`
- Modify: `src/features/bunker/bunker.realtime.ts`
- Test: `src/features/admin/bunker/AdminBunkerControl.test.tsx`
- Test: `src/features/bunker/bunker.realtime.test.ts`

**Interfaces:**
- Consumes: existing `load(eventId)` owner read model and Bunker refresh channel.
- Produces: `subscribeRefresh(eventId, callback)` dependency plus bounded 2-second active-game polling.

- [ ] Add a failing component test where a guest refresh event changes mission progress from `0/2` to `1/2` without an owner command.
- [ ] Add a failing realtime test proving multiple subscribers share one channel and unsubscribe cleanly.
- [ ] Extend `AdminBunkerControlDependencies` with the refresh subscription and implement deduplicated reload plus active-only polling.
- [ ] Preserve the last valid state on load failure and prevent overlapping requests with an in-flight guard.
- [ ] Run `npm test -- --run src/features/admin/bunker/AdminBunkerControl.test.tsx src/features/bunker/bunker.realtime.test.ts` and commit `fix: keep bunker host progress live`.

### Task 2: Final unlock gate and audited recovery

**Files:**
- Create: `supabase/migrations/20260823033000_bunker_final_owner_recovery.sql`
- Modify: `src/features/bunker/bunker.service.ts`
- Modify: `src/features/admin/bunker/AdminBunkerControl.tsx`
- Test: `supabase/tests/bunker_global_mission_progress.sql`
- Test: `src/features/admin/bunker/AdminBunkerControl.test.tsx`

**Interfaces:**
- Produces: `owner_force_open_bunker(p_event_id uuid, p_reason text, p_confirmation text) -> jsonb`.
- Normal `owner_advance_bunker_game_state(..., 'BUNKER_OPEN')` rejects when `unlocked_at` is null.

- [ ] Write pgTAP assertions for rejected normal open, accepted unlocked open, rejected blank recovery reason and audited forced open.
- [ ] Write a failing component test that the normal CTA is disabled before unlock and recovery requires reason plus confirmation.
- [ ] Implement the migration with owner authentication, minimum 12-character reason, exact confirmation `ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО` and owner action log payload.
- [ ] Add the service method and visually separate recovery from normal next-stage controls.
- [ ] Run targeted Vitest and database tests; commit `feat: protect bunker final opening`.

### Task 3: M03 five-problem board

**Files:**
- Modify: `src/features/bunker/BunkerMissionActions.tsx`
- Modify: `src/features/bunker/v2/content/missionContent.ts`
- Modify: `src/styles/bunker-player.css`
- Test: `src/features/bunker/BunkerMissionActions.global.test.tsx`
- Test: `src/features/bunker/v2/content/missionContent.test.ts`

**Interfaces:**
- Produces: `M03_PROBLEMS` entries `{ key, label, risk, resolvingItemKey }` and a selection preview.

- [ ] Add failing tests for five visible problem cards, selected/remaining counts and item-to-problem mapping.
- [ ] Add the five canonical risks: water, medical, power, communication and mechanical/navigation.
- [ ] Render item artwork beside each problem and update the preview immediately as checkboxes change.
- [ ] Keep the existing backend payload `{ itemKeys: string[] }` and server validation unchanged.
- [ ] Run targeted tests and commit `feat: explain bunker emergency supplies`.

### Task 4: M04 communication stepper and real item transfer

**Files:**
- Create: `supabase/migrations/20260823034000_bunker_m04_item_transfer.sql`
- Modify: `src/features/bunker/bunkerGlobalMission.service.ts`
- Modify: `src/features/bunker/bunkerRuntime.service.ts`
- Modify: `src/features/bunker/BunkerMissionActions.tsx`
- Modify: `src/styles/bunker-player.css`
- Test: `supabase/tests/bunker_global_mission_progress.sql`
- Test: `src/features/bunker/BunkerMissionActions.global.test.tsx`

**Interfaces:**
- Extends M04 payload with optional `transferItemKey` and required `transferToWagonId` when an item is selected.
- Server marks the source lot `transferred`, creates an available destination lot and records `inventory_transferred`.

- [ ] Add failing UI tests for the four numbered steps, named partner wagons and transfer preview.
- [ ] Add pgTAP tests for valid transfer, unavailable item, non-partner destination and idempotent resubmission.
- [ ] Extend requirements with partner wagon IDs and transferable available items.
- [ ] Implement the transactional transfer and human-readable submitted payload.
- [ ] Render the stepper and keep message validation consistent with SQL.
- [ ] Run targeted UI/service/pgTAP tests and commit `feat: make intercarriage exchange real`.

### Task 5: Character ability action

**Files:**
- Create: `supabase/migrations/20260823035000_bunker_character_ability_action.sql`
- Modify: `src/features/bunker/bunkerRuntime.service.ts`
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/styles/bunker-player.css`
- Test: `supabase/tests/bunker_global_mission_progress.sql`
- Test: `src/features/bunker/BunkerPlayerDashboard.test.tsx`

**Interfaces:**
- Produces: `use_guest_bunker_ability(p_event_slug text, p_device_key text) -> jsonb` and `useAbility()` in guest dependencies.

- [ ] Add failing tests for applicability copy, confirmation, remaining-use decrement and duplicate rejection.
- [ ] Implement owner-safe server validation against active guest/run/profile and apply the existing ability's defined wagon-state effect.
- [ ] Record `ability_used` with guest, carriage, ability and resulting state.
- [ ] Add an explicit phone action with preview and success feedback.
- [ ] Run targeted tests and commit `feat: activate bunker character abilities`.

### Task 6: Large-text mode and simpler mobile navigation

**Files:**
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/styles/bunker-player.css`
- Modify: `src/styles/mobile-hardening.css`
- Test: `src/features/bunker/BunkerPlayerDashboard.test.tsx`
- Test: `src/styles/bunker-mission-actions.scope.test.ts`

**Interfaces:**
- Produces: local preference key `bunker.largeText.v1` and `data-large-text="true"` on the dashboard.

- [ ] Add failing tests for persisted toggle state, 18px body token and 52px targets.
- [ ] Add `КРУПНЫЙ ТЕКСТ` next to the connection/status area with an accessible pressed state.
- [ ] On <=760px show four primary tabs and an `ЕЩЁ` disclosure for the remaining tabs.
- [ ] Ensure selection and focus survive switching between primary and overflow tabs.
- [ ] Run targeted tests and commit `feat: add accessible bunker phone mode`.

### Task 7: Mission replay identity and free narration

**Files:**
- Create: `src/features/bunker/bunkerNarration.ts`
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`
- Modify: `src/features/screen/ScreenAudioControl.tsx`
- Modify: `src/lib/audioManifest.ts`
- Test: `src/features/bunker/BunkerScreenGuard.test.tsx`
- Test: `src/features/bunker/bunkerNarration.test.ts`

**Interfaces:**
- Produces: `createBunkerNarrationController({ synth, getVoices })` with `speak`, `replay`, `stop`, `setEnabled`.
- Scene key is `${globalGameState}:${currentMission?.id ?? ''}`.

- [ ] Add a failing test proving M03→M04 and M05→M06 remount the scene.
- [ ] Add controller tests for Russian voice preference, missing-voice fallback, once-per-mission behavior and disabled state.
- [ ] Implement `speechSynthesis` without blocking ambience or game progress.
- [ ] Expose narration toggle and replay only during Bunker missions after audio arming.
- [ ] Run targeted tests and commit `feat: narrate every bunker mission intro`.

### Task 8: Master event host runbook

**Files:**
- Create: `src/features/admin/runbook/eventHostContent.ts`
- Create: `src/features/admin/runbook/EventHostRunbook.tsx`
- Create: `src/features/admin/runbook/EventHostRunbook.test.tsx`
- Modify: `src/features/admin/AdminShell.tsx`
- Modify: `src/styles/admin.css`

**Interfaces:**
- Produces: `EVENT_HOST_CUES` and `EventHostRunbook({ dashboard })`.
- Completion markers persist under `event.hostRunbook.v1` and never mutate server game state.

- [ ] Add failing tests for all event sections, cue copy, duration, prerequisites, completion persistence and suggested-current cue.
- [ ] Author cues for arrival, registration, premiere, carriage assignment, quiz, final five, MK, Bunker, final and epilogue.
- [ ] Render sticky current cue first and a collapsible full timeline below it.
- [ ] Include read/improvise/technical/next blocks and link module status without adding new authority.
- [ ] Run targeted tests and commit `feat: add full event host runbook`.

### Task 9: Generate and integrate 30 quiz images

**Files:**
- Create: `public/images/quiz/q01.webp` through `q30.webp`
- Create: `public/images/quiz/q01.avif` through `q30.avif`
- Create: `src/features/visual/quizGeneratedAssetContract.test.ts`
- Create: `supabase/migrations/20260823040000_quiz_question_images.sql`
- Modify: `src/features/screen/QuizScreenScene.tsx`
- Test: `src/features/screen/QuizScreenScene.test.tsx`

**Interfaces:**
- Seeded standard question sort order `N` maps to `/images/quiz/qNN.webp`.

- [ ] Generate each question image separately with built-in ImageGen using the established vintage editorial railway palette, no text, no logos and no recognizable real people.
- [ ] Inspect each output, reject visual failures, then copy accepted originals into the project.
- [ ] Optimize each accepted image to WebP and AVIF with the bundled workspace image libraries.
- [ ] Add an asset contract checking 30 pairs, non-zero size and landscape dimensions.
- [ ] Add an idempotent migration updating only seeded standard questions by sort order.
- [ ] Add `<picture>` AVIF/WebP rendering on TV while preserving the existing phone fallback.
- [ ] Run asset/UI tests and commit `feat: illustrate every quiz question`.

### Task 10: Responsive browser coverage

**Files:**
- Create: `e2e/bunker-responsive-flow.spec.ts`
- Modify: `e2e/screen-readiness.spec.ts`
- Modify: `playwright.config.ts` only if named projects are required.

**Interfaces:**
- Uses existing E2E owner/guest setup and authoritative Bunker RPC flow.

- [ ] Add phone checks at 320×720 and 390×844 for M03, M04, large text and navigation.
- [ ] Add projector checks at 1366×768 and 1920×1080 for M01, M03, M04, M06 and final.
- [ ] Assert important bounding boxes remain within viewport and primary actions remain visible; do not rely only on horizontal overflow.
- [ ] Assert intro identity changes and quiz image assets load without naturalWidth zero.
- [ ] Run the GitHub E2E workflow equivalent against local Supabase and commit `test: cover final event experience layouts`.

### Task 11: Integration, production migrations and GitHub-only release

**Files:**
- Update: this plan ledger only until verification is complete.

**Interfaces:**
- Final output is one reviewed branch merged to `main`; Lovable syncs from GitHub.

- [ ] Rebase or merge fresh `origin/main`, resolve only scoped conflicts and verify user commit `b158e61` remains an ancestor.
- [ ] Run `npm test -- --run`, `npm run build`, `git diff --check` and all pgTAP/database checks.
- [ ] Run the full E2E workflow and inspect screenshots at all specified viewports.
- [ ] Dispatch a final whole-branch reviewer and address every load-bearing finding.
- [ ] Push the tested branch and wait for GitHub CI, database-tests and E2E to pass on the exact SHA.
- [ ] Apply only the new tested Supabase migrations to project `vogcchocbpqqwhfnzzwy` and verify their migration records.
- [ ] Merge through GitHub with expected-head protection, verify `origin/main`, then smoke-test `https://liza-viktor.site` after Lovable publishes the GitHub revision.
