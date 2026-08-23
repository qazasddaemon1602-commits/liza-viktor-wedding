# Registration Carriage Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-safe live top-down carriage seating map to the public registration screen, optional while registration is open and automatic when all expected guests are registered.

**Architecture:** Build one public server-owned read model from existing events, active carriages and real guests. Keep QR and local preview behavior in the current idle registration screen, poll the read model for owner reassignments, and switch `ScreenPage` to a full map only when the authoritative response says `complete`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase/Postgres/pgTAP, existing screen events/realtime, CSS Grid.

**Spec:** `docs/superpowers/specs/2026-08-23-registration-carriage-map-design.md`

## Global Constraints

- Do not change registration, carriage assignment or ticket mechanics.
- Do not expose full names, phones, tokens or affiliations in the public RPC.
- Exclude `__BUNKER_TEST__` guests and use `least(expected_guest_count, 40)` only when expected count is positive.
- `seatIndex` is visual-only and deterministic; do not add a seats table.
- Keep QR available until the authoritative response is `complete`; preserve the last valid map on transient errors.
- Do not publish, deploy or apply production migrations without explicit user authorization.

### Task 1: Privacy-safe carriage map RPC

**Files:**
- Create: `supabase/migrations/20260823042000_registration_carriage_map.sql`
- Create: `supabase/tests/registration_carriage_map.sql`
- Modify: `src/integrations/supabase/types.ts`

- [ ] Add failing pgTAP assertions for function grants/search path, `not_found`, registration/complete states, 2–5 active wagons, deterministic ordering and initials-only payloads.
- [ ] Add failing checks that Bunker test guests are excluded, expected zero never completes and unassigned/disabled-wagon guests are counted.
- [ ] Implement `get_registration_carriage_map(p_event_slug text)` as a fixed-search-path `SECURITY DEFINER` function with no direct table grants.
- [ ] Update generated TypeScript declarations and run focused SQL/security/type checks.
- [ ] Commit `feat: expose private-safe registration carriage map`.

### Task 2: Service parser and top-down carriage component

**Files:**
- Create: `src/features/screen/carriageMap.service.ts`
- Create: `src/features/screen/carriageMap.service.test.ts`
- Create: `src/features/screen/CarriageMapScreen.tsx`
- Create: `src/features/screen/CarriageMapScreen.test.tsx`
- Modify: `src/styles/wedding-editorial.css`

- [ ] Add failing parser tests for all response states and unsafe/malformed payload rejection.
- [ ] Add failing rendering tests for 2, 3, 4 and 5 wagons, stable seat circles, initials, empty wagons, unassigned count and overflow.
- [ ] Implement compact/full variants with accessible labels and `data-carriage-count` responsive layout.
- [ ] Add 16:9 CSS layouts: 2/3 in one row, 4 in 2×2, 5 in centered 3+2.
- [ ] Run focused service/component/style tests and commit `feat: draw live carriage seating map`.

### Task 3: QR preview and automatic full-screen switch

**Files:**
- Modify: `src/features/screen/IdleRegistrationScreen.tsx`
- Modify: `src/features/screen/IdleRegistrationScreen.test.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`
- Create: `src/features/screen/ScreenPage.registration-map.test.tsx`
- Modify: `src/styles/wedding-editorial.css`

- [ ] Add failing tests for QR-first registration, `ОТКРЫТЬ КАРТУ СОСТАВА`, `M` shortcut, return-to-QR and no server mutation.
- [ ] Add failing ScreenPage tests for initial load, guest-registered refresh, 2-second polling, overlapping-load prevention, last-valid-state preservation and cleanup.
- [ ] Add failing tests that only `complete` automatically replaces QR and `not_found` preserves the existing idle scene.
- [ ] Wire the existing public client, screen event signal and bounded polling into the new read model.
- [ ] Run focused screen tests and commit `feat: promote carriage map when registration completes`.

### Task 4: Regression and responsive rehearsal

- [ ] Run all screen/registration Vitest suites, typecheck, build and the full test suite.
- [ ] Run focused and full Supabase pgTAP suites in an environment with local Supabase available.
- [ ] Verify 2–5 wagons at 1366×768 and 1920×1080, including long initials, maximum expected count and unassigned guests.
- [ ] Rehearse registration, owner reassignment, transient disconnect/reconnect and reset.
- [ ] Run independent spec/security review and code-quality review; fix findings and rerun affected tests.
