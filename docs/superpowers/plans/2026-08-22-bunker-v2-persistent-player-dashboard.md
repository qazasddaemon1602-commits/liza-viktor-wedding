# Bunker V2 Persistent Player Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Follow TDD: write the failing test first, verify the intended failure, then add only the production code required to make it pass.

**Goal:** Make the seven-section Bunker V2 guest dashboard durable across mission transitions without changing the frozen `BunkerV2ActiveGuestRuntime` contract or exposing another wagon's/private final data.

**Architecture:** Add a separate read-only guest projection `get_guest_bunker_v2_dashboard(text,text)` backed by authoritative V2 ledgers/tables. Parse it through a strict TypeScript service, load it independently in `useGuestBunkerLiveState`, and pass the last valid snapshot through `JoinPage → GuestHub → BunkerPlayerDashboard`. Mission-specific projections stay transient and unchanged.

**Tech Stack:** Supabase/PostgreSQL 17, pgTAP, React 18, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-bunker-v2-persistent-player-dashboard-design.md`

## Global constraints

- Work only on `feat/bunker-v2-completion-20260822`.
- Do not merge to `main` and do not implement through Lovable.
- Do not rewrite published Git history: no force-push, rebase, amend, or squash of pushed commits.
- All database changes are forward-only migrations; never edit an already-published migration.
- Do not apply V2 DDL to production Supabase. Use repository migrations/tests only until an isolated/local database gate is actually available.
- Preserve V1 behavior and the exact `BunkerV2ActiveGuestRuntime` shape.
- No direct client SELECTs from protected Bunker tables.
- No final `canonical_value` / `normalized_value`, unrevealed hidden traits, other-wagon private archive, or owner diagnostics in the dashboard projection.
- A dashboard read failure must never blank a valid runtime or active mission. Keep the last valid dashboard snapshot.
- Do not claim a test suite passed unless it actually ran. Current GitHub Actions runner may fail before step 1; that infrastructure failure is not a code result.

---

### Task 1: Define the server security/read-model contract

**Files:**
- Create: `supabase/tests/bunker_v2_persistent_dashboard.sql`
- Create: `supabase/migrations/20260822071000_bunker_v2_persistent_dashboard.sql`

- [ ] RED: add pgTAP assertions for `get_guest_bunker_v2_dashboard(text,text)` before the migration exists.
- [ ] Assert anon/authenticated may execute the RPC while direct SELECT on `bunker_guest_profiles`, `bunker_inventory_lots`, `bunker_archive_entries`, `bunker_archive_entitlements`, and `bunker_wagon_state` stays unavailable.
- [ ] Assert the function definition resolves identity through `_bunker_guest_id`, checks `contract_version`, and scopes data by event/run/viewer carriage.
- [ ] Assert archive access is based on active `bunker_archive_entitlements` limited to `owner_scope_kind='global'` or the viewer wagon.
- [ ] Assert the function definition does not reference `bunker_final_parameters`, `canonical_value`, or `normalized_value`.
- [ ] GREEN: add the forward migration with a `security definer` / `set search_path=''` RPC returning inactive `idle|not_found|legacy` shapes and one strict active shape.
- [ ] Passengers: real name, profession, visible skill, character status, reveal flag, hidden trait only when revealed.
- [ ] Inventory: aggregate current ledger quantities per item into `available/used/transferred/lost` for the viewer wagon.
- [ ] Archive: return only active entitled global/own-wagon entries; return `{}` content for locked entries and permitted stored content for partial/decoded entries.
- [ ] Wagon state: return all current authoritative state fields from the viewer wagon row.
- [ ] Verification target when DB runner becomes available: `supabase test db`.
- [ ] Commit RED separately as `test: define persistent bunker dashboard contract`.
- [ ] Commit GREEN separately as `feat: add persistent bunker dashboard read model`.

### Task 2: Add a strict TypeScript parser and RPC loader

**Files:**
- Create: `src/features/bunker/v2/dashboard.service.test.ts`
- Create: `src/features/bunker/v2/dashboard.service.ts`

- [ ] RED: fixture for the active RPC shape with passengers, inventory, archive, and wagon state.
- [ ] RED: fixtures for `idle`, `not_found`, and `legacy`.
- [ ] RED: reject unknown/extra top-level keys, malformed timestamps, negative quantities, invalid status enums, invalid route choice, malformed wagon state, and a hidden trait present while `hiddenTraitRevealed=false`.
- [ ] RED: assert the loader calls exactly `get_guest_bunker_v2_dashboard` with `p_event_slug` and `p_device_key`.
- [ ] GREEN: define `BunkerV2DashboardReadModel`, narrow enum types, strict validators, and `getGuestBunkerV2Dashboard(...)` using `throwBunkerV2RpcError`.
- [ ] Keep final secret values absent from the client model by construction.
- [ ] Verification targets: `npm test -- src/features/bunker/v2/dashboard.service.test.ts` and `npm run typecheck` when a runner is available.
- [ ] Commit as `feat: parse persistent bunker dashboard`.

### Task 3: Keep the projection alive across mission transitions

**Files:**
- Create: `src/features/bunker/useGuestBunkerLiveState.dashboard.test.ts`
- Modify: `src/features/bunker/useGuestBunkerLiveState.ts`
- Modify: `src/features/registration/GuestJoinPage.tsx`

- [ ] RED: prove a valid dashboard snapshot loaded during M03 remains present after runtime moves to M05 and M03/M04 mission projections are cleared.
- [ ] RED: prove a later dashboard RPC error retains the previous valid dashboard and exposes a recoverable dashboard connection warning instead of setting dashboard to `undefined`.
- [ ] RED: prove a subsequent successful refresh replaces the stale snapshot and clears its warning.
- [ ] GREEN: add optional `loadDashboard(deviceKey)` to `GuestBunkerLiveDependencies`.
- [ ] GREEN: add `dashboard` and `dashboardError` state to the hook; load independently from runtime and mission projections.
- [ ] Never include dashboard state in `clearNonCurrent`; mission stage changes only clear mission-specific models.
- [ ] Reuse existing periodic/realtime/focus/online refresh paths; do not create a second realtime channel.
- [ ] Wire the production loader in `GuestJoinPage.tsx` with `getGuestBunkerV2Dashboard`.
- [ ] Verification targets: focused hook tests plus `npm run typecheck` when available.
- [ ] Commit as `feat: keep bunker dashboard live across missions`.

### Task 4: Use the persistent projection in the guest UI

**Files:**
- Modify first (RED): `src/features/bunker/BunkerPlayerDashboard.test.tsx`
- Create or modify first (RED): `src/features/guest/GuestHub.persistent-dashboard.test.tsx`
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/features/guest/GuestHub.tsx`
- Modify: `src/features/registration/JoinPage.tsx`

- [ ] RED: render a V2 M05 runtime with no M01/M03/M04 models but an active persistent dashboard projection.
- [ ] Assert `ПАССАЖИРЫ` still lists the wagon's real passengers and visible professions/skills.
- [ ] Assert unrevealed passenger hidden traits are absent while revealed traits are shown.
- [ ] Assert `ИНВЕНТАРЬ` still displays authoritative available quantities and human-readable used/transferred/lost history.
- [ ] Assert `АРХИВ` displays entitled entries with Russian metadata even after the mission that discovered them ended.
- [ ] Assert `СОСТОЯНИЕ` renders power, communication, navigation, technical door, track damage, water, route, route bonus, instability, sector discovery, and coordination state.
- [ ] GREEN: add optional `dashboard` prop to `BunkerPlayerDashboard`; for V2 prefer it over transient mission snapshots. Leave V1 sources unchanged.
- [ ] GREEN: add `bunkerDashboard` / `bunkerDashboardError` through `GuestHub` and `JoinPage`.
- [ ] Preserve the dedicated results replacement during `BUNKER_OPEN` / `FINISHED`.
- [ ] Preserve current active mission rendering and all command callbacks.
- [ ] Verification targets: `BunkerPlayerDashboard`, `GuestHub`, `JoinPage` focused tests plus typecheck/build when available.
- [ ] Commit as `feat: show persistent bunker dashboard on guest phone`.

### Task 5: Production dependency and regression coverage

**Files:**
- Modify first (RED): `src/features/registration/GuestJoinPage.test.tsx`
- Modify: `src/features/registration/GuestJoinPage.tsx` if any remaining production wiring is missing.
- Modify: `e2e/bunker-v2-full-flow.spec.ts`

- [ ] RED: production-dependency test asserts `GuestJoinPage` calls `get_guest_bunker_v2_dashboard` with the restored device identity during an active V2 run.
- [ ] Keep old V1 runtime-only dependency tests valid; inactive/legacy dashboard responses must not break the page.
- [ ] Extend the rehearsal E2E only using a real device-bound test guest. Do not assume synthetic seeded guests have a device key.
- [ ] Before changing Test Mode, inspect the registration/device binding schema; prefer registering one normal test guest through existing registration RPC and then preparing the 15–40 guest run if that keeps the scenario isolated.
- [ ] Verify one guest's dashboard before and after at least M03/M04 → M05: passengers remain, current inventory remains, wagon state persists, and an already-entitled archive entry remains visible.
- [ ] Ensure reset cleanup restores the E2E event after the scenario.
- [ ] Commit as `test: cover persistent bunker dashboard end to end`.

### Task 6: Release gate and review

**Files:**
- No production changes unless a failing test identifies a root cause.

- [ ] Check GitHub Actions after each meaningful push. If jobs again contain `steps: []`, record it as runner infrastructure failure, not a test result.
- [ ] When execution is available, run in this order: `npm test` → `npm run typecheck` → `npm run build` → `supabase test db` → `npm run e2e`.
- [ ] Fix failures one root cause at a time with a reproducing test first.
- [ ] Re-run the full sequence after the final fix; do not infer success from focused tests.
- [ ] Review the feature diff for secrets, direct table access, V1 changes, rewritten migrations, and accidental `main`/Lovable changes.
- [ ] Keep PR #28 draft/unmerged until every real release gate is green.
- [ ] Final verification commit only after real evidence: `chore: verify persistent bunker dashboard`.
