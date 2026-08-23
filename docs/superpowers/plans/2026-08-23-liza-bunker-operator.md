# Liza Bunker Operator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Liza an active but balance-neutral Bunker participant through her existing private page, four timed radio transmissions, a cinematic identity reveal and story-specific photographs.

**Architecture:** Keep the existing Bunker state machine and all six mission mechanics intact. Add a small server-authoritative operator message layer keyed by the active Bunker run, reuse the existing private Liza token and Bunker refresh channel, then project the latest transmission into the existing TV and phone shells. Treat `BUNKER_OPEN` as the Liza reveal and preserve `FINISHED` for the existing statistics plus a couple epilogue.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase/Postgres/pgTAP, existing Bunker realtime/polling, existing audio system, built-in ImageGen.

**Spec:** `docs/superpowers/specs/2026-08-23-liza-bunker-operator-design.md`

## Global Constraints

- Work from the current approved branch based on `lovable/main` commit `1c563f3`; do not rebase, force-push or rewrite published history.
- Do not publish, push, deploy or apply production migrations without a separate explicit instruction from the user.
- Use TDD for production changes and keep the migration forward-only and idempotent.
- Preserve MISSION_01 through MISSION_06 rules, timing, scoring, inventory, abilities and completion gates.
- Liza may send exactly one predefined phrase at `MISSION_02`, `MISSION_04`, `MISSION_06` and `FINAL_30`; the phrase never affects game balance.
- Hide Liza's name and portrait before `BUNKER_OPEN`; pre-reveal UI says `Оператор BK-17` or `Неизвестный оператор` only.
- Reuse `final_five_role_access`, `broadcastBunkerRefresh`, `subscribeToBunkerRefresh`, active-game polling and the global sound/mute preference.
- Process the four supplied photographs non-destructively, preserve both identities, and keep the originals outside the repository unchanged.

---

### Task 1: Shared operator phrase and timing contract

**Files:**
- Create: `src/features/bunker/operator/bunkerOperator.contract.ts`
- Create: `src/features/bunker/operator/bunkerOperator.contract.test.ts`

**Interfaces:**
- Produces: `BunkerOperatorStage = 'MISSION_02' | 'MISSION_04' | 'MISSION_06' | 'FINAL_30'`.
- Produces: `BUNKER_OPERATOR_PHRASES`, `getOperatorStage(globalGameState)`, `getDeterministicFallback(stage)` and `isOperatorWindowOpen({ enteredAt, serverNow, windowSeconds })`.
- Each catalog entry is `{ key, body }`; catalog keys and Russian copy must exactly match the approved spec.

- [ ] Add failing tests for all four stage mappings, both phrases per stage, the exact fallback phrase and non-operator states returning `null`.
- [ ] Add failing boundary tests for the 45-second window using server timestamps, including exactly-at-deadline closed behavior.
- [ ] Implement the immutable phrase catalog and pure timing helpers without importing React or Supabase.
- [ ] Run `npm test -- --run src/features/bunker/operator/bunkerOperator.contract.test.ts`.
- [ ] Commit `feat: define bunker operator transmission contract`.

### Task 2: Server-authoritative operator message layer

**Files:**
- Create: `supabase/migrations/20260823041000_liza_bunker_operator.sql`
- Create: `supabase/tests/bunker_operator.sql`
- Modify: `src/integrations/supabase/types.ts`
- Modify: reset SQL only where the current authoritative owner reset functions are redefined by the new migration.

**Interfaces:**
- Creates: `public.bunker_operator_messages(id uuid, event_id uuid, run_nonce text, stage text, option_key text, body text, source text, published_at timestamptz, created_at timestamptz)` with unique `(event_id, run_nonce, stage)`.
- Produces: `get_liza_bunker_operator_state(p_event_slug text, p_token text) -> jsonb`.
- Produces: `submit_liza_bunker_operator_phrase(p_event_slug text, p_token text, p_stage text, p_option_key text) -> jsonb`.
- Produces: `get_bunker_operator_feed(p_event_slug text) -> jsonb`.
- Uses the existing `final_five_role_access` SHA-256 token validation for role `liza`; direct table reads/writes remain revoked from `anon` and `authenticated`.

- [ ] Add failing pgTAP checks for table shape, unique run-stage constraint, grants and absence of direct read/write privileges.
- [ ] Add failing function tests for invalid token, wrong role, inactive run, wrong stage, invalid option, one-send idempotency and a valid Liza submission.
- [ ] Add failing feed/state tests proving deterministic fallback after 45 seconds, no duplicate fallback row, server-time response fields and no Liza identity before `BUNKER_OPEN`.
- [ ] Implement the table and three security-definer RPCs with a fixed `search_path`, explicit event/run lookup and server-side phrase catalog validation.
- [ ] Redefine the authoritative full/destructive reset functions in this forward migration so operator rows are deleted with the run; do not edit historical migrations.
- [ ] Update generated Supabase TypeScript declarations for the table and RPC signatures.
- [ ] Run the project Supabase SQL test command for `supabase/tests/bunker_operator.sql` and the existing reset/Bunker suites.
- [ ] Commit `feat: add secure bunker operator messages`.

### Task 3: Liza operator mode on the existing private page

**Files:**
- Create: `src/features/bunker/operator/bunkerOperator.service.ts`
- Create: `src/features/bunker/operator/bunkerOperator.service.test.ts`
- Create: `src/features/bunker/operator/LizaBunkerOperatorPanel.tsx`
- Create: `src/features/bunker/operator/LizaBunkerOperatorPanel.test.tsx`
- Modify: `src/features/quiz/FinalFiveRolePage.tsx`
- Modify: `src/features/quiz/FinalFiveRolePage.test.tsx`
- Modify: `src/styles/bunker-player.css`

**Interfaces:**
- Produces: parsed `LizaBunkerOperatorState` variants `invalid_access`, `idle`, `active`, `revealed`, `finished`.
- Active state includes `stage`, `enteredAt`, `sendUntil`, `serverNow`, two approved options and optional selected message.
- `LizaBunkerOperatorPanel` receives load, submit, subscribe and broadcast dependencies for deterministic component tests.

- [ ] Add failing parser tests for every RPC state and malformed payload rejection.
- [ ] Add failing UI tests for anonymous BK-17 header, two phrase buttons, countdown, single-send lock, missed-window fallback, submit error retry and no balance/score controls.
- [ ] Add a failing integration test proving `/liza?token=...` enters operator mode only while Bunker is active and otherwise preserves the existing Final Five role experience.
- [ ] Implement RPC adapters, 2-second active polling and Bunker refresh subscription without overlapping loads.
- [ ] Submit using the token already present on the private page, broadcast a Bunker refresh after success and keep the last valid state during transient network errors.
- [ ] Render accessible 52px minimum actions, disabled/sent states and muted-friendly visual feedback in the existing editorial Bunker language.
- [ ] Run `npm test -- --run src/features/bunker/operator src/features/quiz/FinalFiveRolePage.test.tsx`.
- [ ] Commit `feat: turn Liza page into bunker operator console`.

### Task 4: Transmission feed on projector and guest phones

**Files:**
- Create: `src/features/bunker/operator/useBunkerOperatorFeed.ts`
- Create: `src/features/bunker/operator/useBunkerOperatorFeed.test.tsx`
- Create: `src/features/bunker/operator/BunkerOperatorTransmission.tsx`
- Create: `src/features/bunker/operator/BunkerOperatorTransmission.test.tsx`
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`
- Modify: `src/features/bunker/BunkerScreenGuard.test.tsx`
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/features/bunker/BunkerPlayerDashboard.test.tsx`
- Modify: `src/styles/bunker-screen.css`
- Modify: `src/styles/bunker-player.css`

**Interfaces:**
- Produces: `BunkerOperatorFeed` with the current run's latest `{ id, stage, body, source, publishedAt }` and reveal status.
- Projector variant displays a newly observed message for 8 seconds with heading `ВХОДЯЩИЙ СИГНАЛ · ОПЕРАТОР BK-17`.
- Phone variant persistently displays the latest message in a compact read-only card.

- [ ] Add failing hook tests for initial load, refresh subscription, bounded polling, message-id deduplication and cleanup.
- [ ] Add failing projector tests for the exact anonymous heading, 8-second dismissal, reduced-motion behavior and a later message appearing after dismissal.
- [ ] Add failing phone tests for persistent latest-message rendering across tabs and correct fallback labeling.
- [ ] Implement one shared feed hook using `get_bunker_operator_feed`, `subscribeToBunkerRefresh` and active-state polling.
- [ ] Mount the projector overlay above existing mission scenes without routing through generic `screen_events`.
- [ ] Mount the compact card in the persistent guest dashboard shell without changing mission action props or completion logic.
- [ ] Trigger an existing short radio/UI signal only when a new message ID becomes visible and only when global sound is enabled.
- [ ] Run targeted hook, screen and dashboard tests.
- [ ] Commit `feat: broadcast BK-17 transmissions across bunker screens`.

### Task 5: Liza reveal at BUNKER_OPEN and couple epilogue at FINISHED

**Files:**
- Create: `src/features/bunker/operator/LizaRevealScreen.tsx`
- Create: `src/features/bunker/operator/LizaRevealScreen.test.tsx`
- Create: `src/features/bunker/operator/LizaRevealPlayer.tsx`
- Create: `src/features/bunker/operator/LizaRevealPlayer.test.tsx`
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/features/bunker/BunkerScreenGuard.unknown-passenger.test.tsx`
- Modify: `src/features/bunker/v2/UnknownPassengerScreen.tsx`
- Modify: `src/features/bunker/v2/UnknownPassengerPlayer.tsx`
- Modify: `src/features/bunker/v2/BunkerResultsScreen.tsx`
- Modify: `src/features/bunker/v2/BunkerResultsPlayer.tsx`
- Modify: `src/styles/bunker-screen.css`
- Modify: `src/styles/bunker-player.css`

**Interfaces:**
- `BUNKER_OPEN` renders the reveal copy: `Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза`.
- `FINISHED` retains the existing result/statistics model and adds the couple epilogue image/copy.
- Internal `UNKNOWN_PASSENGER` state remains unchanged; visible copy becomes `Неизвестный оператор`.

- [ ] Add failing route-state tests proving `BUNKER_OPEN` no longer renders result statistics and `FINISHED` still does.
- [ ] Add failing reveal tests for Liza name/photo, exact copy, phone/projector accessibility and no pre-reveal identity leakage.
- [ ] Add failing audio tests for `door.wav` followed by `reveal.wav`, global mute compliance, replay safety and timer cleanup.
- [ ] Implement dedicated TV and phone reveal scenes and keep legacy/non-v2 compatibility branches intact.
- [ ] Update only visible unknown-passenger copy; retain SQL enum/state identifiers and read-model compatibility.
- [ ] Extend existing finished results with an epilogue slot without removing any score, wagon or character statistics.
- [ ] Run targeted Bunker state, reveal, results and unknown-passenger tests.
- [ ] Commit `feat: reveal Liza at the end of the bunker route`.

### Task 6: Produce and integrate the four-person story media set

**Files:**
- Create: `public/images/bunker/story/liza-operator.avif`
- Create: `public/images/bunker/story/liza-operator.webp`
- Create: `public/images/bunker/story/viktor-route.avif`
- Create: `public/images/bunker/story/viktor-route.webp`
- Create: `public/images/bunker/story/liza-reveal.avif`
- Create: `public/images/bunker/story/liza-reveal.webp`
- Create: `public/images/bunker/story/couple-epilogue.avif`
- Create: `public/images/bunker/story/couple-epilogue.webp`
- Create: `src/features/bunker/operator/bunkerOperatorAssets.test.ts`
- Modify: operator/reveal/results components from Tasks 3-5 only where image sources are wired.

**Interfaces:**
- Operator portrait source: supplied serious Liza photograph.
- Viktor route source: supplied seated Viktor photograph.
- Reveal source: supplied smiling Liza photograph.
- Epilogue source: supplied couple photograph.
- Every component uses `<picture>` with AVIF first and WebP fallback, fixed aspect ratio, `object-fit: cover`, meaningful Russian alt text and no remote URLs.

- [ ] Use built-in ImageGen in image-edit mode on each supplied local photograph; preserve recognizable identity, pose and facial proportions.
- [ ] Apply the approved fairytale-railway wardrobe: Liza as a graphite-blue headset dispatcher before reveal, Viktor in a restrained midnight-blue conductor/engineer-inspired suit, Liza in an ivory/champagne modern-princess gown and thin diadem at reveal, and both looks united in the couple epilogue.
- [ ] Keep the styling editorial rather than literal cosplay: no hat, oversized crown, logos, badges, pasted locomotive or fantasy castle; retain the coherent graphite/blue archive grade, cream/brass light and subtle grain.
- [ ] Inspect all four full-resolution outputs and regenerate any asset with identity drift, malformed hands/glasses or unusable crop.
- [ ] Export responsive AVIF and WebP files into `public/images/bunker/story/` without changing the supplied originals.
- [ ] Add an asset contract checking eight files, non-zero dimensions, valid formats and minimum long-edge resolution.
- [ ] Wire the anonymous portrait with name-hidden treatment, Viktor route insert, Liza reveal and couple epilogue to their approved stages.
- [ ] Run the asset contract and affected component tests.
- [ ] Commit `feat: add cinematic Liza and Viktor bunker story media`.

### Task 7: Integration regression and event rehearsal

**Files:**
- Create: `e2e/liza-bunker-operator.spec.ts` if the repository's existing E2E harness supports the required Supabase setup.
- Update: this plan checklist/SDD ledger only after verification; do not change production code merely to make an E2E fixture easier.

**Interfaces:**
- Rehearsal path: valid Liza link → M02 send → projector/phone update → M04 fallback → M06 send → FINAL_30 send → `BUNKER_OPEN` reveal → `FINISHED` statistics and epilogue → owner full reset.

- [ ] Run targeted Vitest suites for contract, service, Liza page, feed, screen, player, reveal, results and asset contract.
- [ ] Run SQL tests for operator RPCs plus existing Bunker state, reset and security suites.
- [ ] Run `npm test -- --run`, `npm run build` and the repository's type/lint commands if defined.
- [ ] Rehearse valid token, expired/invalid token, double click, two open Liza tabs, missed 45-second window, disconnected/reconnected projector, muted sound and reduced motion.
- [ ] Verify at 390x844, 1366x768 and 1920x1080 that actions, overlays, portraits, statistics and epilogue remain readable and uncropped.
- [ ] Verify the reset removes all operator messages and a new Bunker run cannot see a previous run's transmission.
- [ ] Run a final specification-compliance review and a separate code-quality review; fix all high/medium findings and rerun affected tests.
- [ ] Commit `test: verify Liza bunker operator journey` only if verification adds tracked tests or documentation.

## Completion Gate

- Liza participates through her existing private link, with no new credential or public identity leak.
- Exactly four interaction windows exist and all options are predefined and balance-neutral.
- Projector and phones converge through Bunker refresh plus polling and tolerate disconnect/reconnect.
- `BUNKER_OPEN` reveals Liza; `FINISHED` preserves statistics and adds the couple epilogue.
- All four edited photographs are local, responsive, visually coherent and identity-preserving.
- Full unit/integration/SQL/build verification is green.
- The branch remains local until the user explicitly authorizes publication.
