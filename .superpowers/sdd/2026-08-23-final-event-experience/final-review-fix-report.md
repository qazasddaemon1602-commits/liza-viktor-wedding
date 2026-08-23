# Final review fix wave

Date: 2026-08-23

Branch: `codex/final-experience-20260823`

Base reviewed: `5095254`

## Scope closed

### 1. Live TV convergence

- `BunkerScreenGuard` now polls only while the authoritative Bunker state is active, every 2 seconds.
- All polling and realtime invalidations share one in-flight request. Slow requests are coalesced, older generations cannot overwrite a remounted guard, and a load failure preserves the last valid projector scene.
- Bunker realtime channels are cached per Supabase client and event slug. A guest without a local subscriber uses one publisher-only transport instead of creating and subscribing a new channel on every submit; mounted local listeners share the same channel and tear down after the last listener.
- Successful guest legacy mission submissions, final-code submissions, global M01-M06 submissions, and ability use all call one shared post-mutation convergence helper. Broadcast is fire-and-forget/best-effort and can never convert an already successful RPC into a guest-facing failure; the sender then reloads its authoritative runtime.
- Added a Playwright scenario that opens the TV before the guest action, completes M01 from the phone, observes projector progress move from `0 / 2` to `1 / 2`, and verifies that the projector remains on M01 (no owner transition).

### 2. Authoritative M03 ability/state board

- `BunkerPlayerDashboard` passes authoritative `wagonState` through to `BunkerMissionActions`.
- Water, power, and mechanical/navigation risks close from explicit ability markers first, then from their authoritative server state.
- Closed risks are removed from the remaining count. Their canonical inventory controls are disabled and explain that the item should be saved.
- Ability closures use the explicit copy `ЗАКРЫТО СПОСОБНОСТЬЮ`; server-state closures are separately labelled.
- Communication and medical risks are not inferred from story text or generic clues. No authoritative M03 marker currently exists for them, so they remain open until solved with inventory.
- The submitted payload remains the canonical `itemKeys` list, preserving backend semantics and inventory ownership.

### 3. Quiz SECURITY DEFINER search path

- `owner_seed_default_quiz_questions` now uses `set search_path = ''`.
- The migration contract test verifies that referenced schemas remain explicitly qualified.

### 4. Realtime event identity

- `AdminBunkerControl` now requires an explicit `eventSlug` distinct from the UUID `eventId`.
- Broadcast, refresh subscription, and projector presence use that slug.
- `AdminBunkerDock` threads `dashboard.event.slug` into the control.
- A component test verifies that realtime receives the slug and never the UUID.

### 5. M04 lot quantity and ownership clarity

- Mission requirements expose every transferable inventory lot as its own option: stable `lotId`, server item key, and that lot's quantity. Quantities are no longer aggregated by item type.
- The phone selects and previews a specific lot, including its exact quantity.
- The client submits only `transferLotId` plus destination. The server locks and validates that exact available lot against event, run, source wagon, and partner group.
- Item key, label, quantity, and transfer summary are all derived server-side; the client cannot spoof them.
- The original completion idempotency is preserved: a repeated completed M04 response returns before a second transfer/event can be created.
- pgTAP coverage now includes stable lot IDs, unavailable lots, foreign-wagon lot spoofing, trusted summary/quantity, and idempotency.

## RED

Initial focused command:

`npm test -- --run src/features/bunker/BunkerScreenGuard.test.tsx src/features/bunker/bunker.realtime.test.ts src/features/bunker/useGuestBunkerLiveState.test.ts src/features/admin/bunker/AdminBunkerControl.test.tsx src/features/bunker/BunkerMissionActions.global.test.tsx src/features/bunker/bunkerGlobalMission.service.test.ts src/features/bunker/bunkerM04Migration.test.ts src/features/visual/quizQuestionImagesMigrationContract.test.ts`

Result: **16 failed, 67 passed**. The failures covered active-only/coalesced polling, guest broadcasts, shared realtime transport, explicit slug identity, M03 authoritative closures, lot-ID transfer contracts, and the empty quiz search path.

A follow-up realtime RED isolated the cross-tab publisher case:

`npm test -- --run src/features/bunker/bunker.realtime.test.ts`

Result: **1 failed, 5 passed** before the publisher-only cached channel was implemented.

## GREEN

- Focused review suite: **8 files passed, 83 tests passed**.
- TypeScript: `npm run typecheck` — **passed**.
- Full Vitest run (single final run): `npm test -- --run` — **170 files passed, 925 tests passed**.
- Production build: `npm run build` — **passed**, 217 modules transformed. Vite reports the existing large-chunk advisory for the 1.42 MB main bundle; this is not a build failure and is outside these five review findings.
- Playwright discovery: `npx playwright test --list` — **32 tests listed in 7 files**, including the new already-open-TV convergence scenario.
- Diff hygiene: `git diff --check` — **passed**; only Git's Windows LF-to-CRLF notices were emitted.
- Static SQL contracts passed inside the full Vitest run for the quiz migration and the M04 lot/ownership migration.

## Deferred executable gates

The current worktree does not have the local Supabase/Postgres runtime or a configured live browser stack. Therefore these commands were deliberately not reported as passed:

1. `supabase test db` — must execute the updated 86-assertion `supabase/tests/bunker_global_mission_progress.sql` suite against a clean migrated database. The repository's `.github/workflows/db-tests.yml` runs this gate.
2. `npm run e2e` — must execute the 32 discovered Chromium tests with the seeded local Supabase environment, including the new cross-tab guest-to-TV scenario. The repository's `.github/workflows/e2e.yml` runs this gate.

No production database, Lovable session, or remote deployment was mutated in this fix wave.

## Compatibility addendum: M04 rolling deployment

The final scoped re-review identified one release-order hazard: an already-open old phone tab can still submit `transferItemKey` while the new frontend and edited historical migration use `transferLotId`.

### Fix and safety rule

- Added the independent forward migration `20260823034500_bunker_m04_transfer_compat.sql`, ordered after the original M04 migration and before character abilities. It uses only `create or replace function`, so it does not depend on replaying or renaming an already-recorded migration.
- The server temporarily accepts either the new exact `transferLotId` or the legacy `transferItemKey`.
- Exact lot ID has priority. If a payload contains both fields, the locked lot's server item key must match the legacy key or the request fails with `invalid Mission 04 transfer item mismatch`.
- A legacy item key resolves deterministically to the earliest available matching lot for the authoritative event, run, and source wagon, ordered by `acquired_at, id`, and locks that lot before transfer.
- Quantity, item key, labels, destination label, and summary remain server-derived. The new requirements and frontend remain strict per-lot UI and do not expose the legacy field in TypeScript.
- The pgTAP plan is now 86 assertions and covers a successful old-tab call, an exact-lot call, consistent dual fields, a dual-field mismatch, unavailable/foreign lots, nonpartner destinations, server-resolved lot persistence, and idempotency.

### Required rollout order

1. Deploy/apply database migrations first, through `20260823034500_bunker_m04_transfer_compat.sql` (and later migrations).
2. Run `supabase test db` in the database-test workflow.
3. Only after the DB gate is green, merge/deploy the frontend commit that sends `transferLotId`.
4. Keep the compatibility migration during the event release window so already-open old tabs continue working. Removal, if desired later, must be a separate forward migration after old clients are no longer possible.

### Addendum RED/GREEN

- RED: `npm test -- --run src/features/bunker/bunkerM04Migration.test.ts` — **2 failed, 2 passed** while the required forward migration was absent.
- Focused GREEN: M04 migration, service, and UI suites — **3 files passed, 21 tests passed**.
- TypeScript: `npm run typecheck` — **passed**.
- Full Vitest: **170 files passed, 927 tests passed**.
- Production build: **passed**, with only the previously noted Vite chunk-size advisory.
- Playwright discovery: **32 tests in 7 files**.
- Diff hygiene: **passed**, with only Windows line-ending notices.
- Still deferred to the configured CI/runtime gates: executable `supabase test db` and `npm run e2e`.
