# Bunker Phase 2 Core State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the durable game session, exact 36-profile character pool, controlled assignment, wagon state, inventory, archive, and event log on top of the existing wedding entities.

**Architecture:** `guests`, `carriages`, and `bunker_state.run_nonce` remain authoritative. New runtime tables reference their IDs, direct table access is revoked, and guest/owner operations use narrowly scoped RPCs. Existing Bunker UI remains compatible while later phases migrate to `global_game_state`.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase/Postgres migrations, pgTAP, Supabase Realtime refresh broadcasts.

**Spec:** `docs/superpowers/specs/2026-08-20-adaptive-bunker-game-design.md`

## Global Constraints

- Never create fictional character names; resolve names from `guests`.
- Never delete wedding questionnaire or couple-answer data.
- Every schema change is a follow-up migration.
- Every exposed table has RLS; direct game-table access is revoked.
- `run_nonce` makes every generated assignment stable across reload/reconnect.
- No visual redesign is part of PHASE 2.

---

### Task 1: Character pool domain contract

**Files:**
- Create: `src/features/bunker/characterPool.ts`
- Create: `src/features/bunker/characterPool.test.ts`

**Interfaces:**
- Produces: `BunkerCharacterProfile`, `BUNKER_CHARACTER_PROFILES`, `validateCharacterPool()`.
- Profile fields: `key`, `profession`, `health`, `visibleSkill`, `hiddenTrait`, `specialAbility`, `abilityDescription`, `tags`.

- [x] **Step 1: Write failing tests** asserting exactly 36 unique profile keys, 36 unique profession/profile combinations, one non-empty special ability per profile, no name field, and coverage of all six required controlled-random groups.
- [x] **Step 2: Run** `vitest run src/features/bunker/characterPool.test.ts` and verify RED because the module does not exist.
- [x] **Step 3: Implement** the exact 36 user-provided profiles as readonly configuration and strict validation helpers.
- [x] **Step 4: Run the focused test and verify GREEN.**

### Task 2: Controlled profile assignment

**Files:**
- Create: `src/features/bunker/characterAssignment.ts`
- Create: `src/features/bunker/characterAssignment.test.ts`
- Modify: `src/features/bunker/gamePlanner.ts`

**Interfaces:**
- Consumes: `BUNKER_CHARACTER_PROFILES` and stable `runSeed`.
- Produces: `assignCharacterProfiles(guestIds, runSeed)` returning one unique profile key per guest when the pool permits.

- [x] **Step 1: Write failing tests** for 12, 16, 20, 32, and 40 guests; assert stable repeatability, all guests assigned once, mandatory technical/medical/information/communication/bunker/navigation coverage, and the 15–20 target mix.
- [x] **Step 2: Run focused tests and verify RED.**
- [x] **Step 3: Implement** seeded shuffle, mandatory-category selection, small-game quotas, and random fill without role strength labels.
- [x] **Step 4: Run tests and verify GREEN.**

### Task 3: PHASE 2 database schema and exact seed

**Files:**
- Create: `supabase/migrations/20260820170000_bunker_phase_2_core_state.sql`
- Create: `supabase/tests/bunker_phase_2_core_state.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produces tables `bunker_character_profiles`, `bunker_wagon_state`, `bunker_inventory_lots`, `bunker_archive_entries`, and `bunker_game_events`.
- Extends `bunker_state` with `global_game_state`, `final_started_at`, `final_duration`, `bunker_revealed`, and `game_mode`.
- Extends `bunker_guest_profiles` with `character_profile_key`, `visible_skill`, `special_ability`, `ability_description`, `character_status`, `hidden_trait_revealed`, `ability_uses_remaining`, `joined_late`.

- [x] **Step 1: Add failing pgTAP contracts** for tables, constraints, RLS, revoked direct privileges, exact profile count, and absence of any character-name column.
- [x] **Step 2: Verify RED** using a read-only production `to_regclass`/column query; do not apply production DDL.
- [x] **Step 3: Add the migration** with FK-safe tables, checks, indexes, RLS, grants/revokes, exact 36-row seed, and append-only-ish write access through server RPCs only.
- [x] **Step 4: Update generated TypeScript database types.**
- [x] **Step 5: Run typecheck and static migration contract inspection.**

### Task 4: Owner session preparation and character distribution RPCs

**Files:**
- Modify the PHASE 2 migration before it is applied.
- Create: `src/features/bunker/bunkerSession.service.ts`
- Create: `src/features/bunker/bunkerSession.service.test.ts`

**Interfaces:**
- Produces RPC `owner_prepare_bunker_game(p_event_id, p_game_mode)`.
- Produces RPC `owner_distribute_bunker_characters(p_event_id)`.
- Produces client functions `prepareBunkerGame()` and `distributeBunkerCharacters()`.

- [x] **Step 1: Write failing service parser/RPC tests.**
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement owner RPCs** with `_require_bunker_owner`, row locking, stable `run_nonce`, dynamic wagon initialization, controlled assignment, idempotent replay, and journal writes.
- [x] **Step 4: Implement strict TypeScript parsers and wrappers.**
- [x] **Step 5: Run focused tests and verify GREEN.**

### Task 5: Late-guest character provisioning

**Files:**
- Modify the PHASE 2 migration before it is applied.
- Create: `src/features/bunker/bunkerRuntime.service.ts`
- Create: `src/features/bunker/bunkerRuntime.service.test.ts`

**Interfaces:**
- Produces registration trigger `_assign_late_bunker_guest()`.
- Guest state adds `joinedLate` and reads the stable real guest identity through the existing binding.

- [x] **Step 1: Add failing tests** for `joinedLate` and hidden-trait privacy in the restored runtime.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement atomic registration-time assignment** from the least-used stable profile; do not rebalance existing guests, wagons, or decisions.
- [x] **Step 4: Return the late-registration marker through the runtime snapshot and verify GREEN.**

### Task 6: Inventory, archive, wagon state, and journal contracts

**Files:**
- Modify the PHASE 2 migration before it is applied.
- Create: `src/features/bunker/bunkerRuntime.types.ts`
- Create: `src/features/bunker/bunkerRuntime.service.ts`
- Create: `src/features/bunker/bunkerRuntime.service.test.ts`

**Interfaces:**
- Produces owner/guest read RPCs returning wagon state, inventory lots, archive entries, and current game state.
- Seeds `medkit`, `radio`, `generator`, `tools`, `water`, and `gas_mask` per active wagon.

- [x] **Step 1: Write failing strict-parser tests** for the complete guest runtime and hidden-data rejection.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement the guest read RPC and TypeScript wrapper; defer the owner aggregate read to the admin phase.**
- [x] **Step 4: Add pgTAP assertions** that quantities cannot be negative and direct mutation is unavailable to clients.
- [x] **Step 5: Run focused tests and verify GREEN.**

### Task 7: PHASE 2 verification checkpoint

**Files:**
- Update: this plan checkboxes after verification.

**Interfaces:**
- Produces the reviewed PHASE 2 foundation consumed by player/admin/TV phases.

- [x] **Step 1: Run** focused character, planner, Bunker service, registration, and admin tests.
- [x] **Step 2: Run** `tsc --noEmit`.
- [x] **Step 3: Run lint if a lint script exists.** No lint script is configured.
- [x] **Step 4: Run** `vite build` and record the existing chunk-size warning separately from errors.
- [x] **Step 5: Inspect guest, owner, and TV permission boundaries and confirm no questionnaire tables are touched.**
- [x] **Step 6: Do not apply or deploy the migration without explicit production authorization.**
