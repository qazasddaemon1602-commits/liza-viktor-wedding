# MK Mobile Recovery Bugfix Plan

> **For agentic workers:** REQUIRED SUB-SKILLS: Use superpowers:systematic-debugging, superpowers:test-driven-development and superpowers:subagent-driven-development.

**Goal:** Make the dedicated `/mortal-kombat` phone page recover automatically from a transient first-load failure or missed realtime event instead of remaining permanently on `АРЕНА ПОКА НЕДОСТУПНА`.

**Root cause evidence:** The production public RPC currently returns a valid `active/registration` projection with `maxPlayers=40`, while `MortalKombatPage` performs only one initial load and reloads only when realtime fires. Any transient network error or missed broadcast leaves the phone in a terminal error state despite a healthy backend.

**Files:**
- Modify: `src/features/mortalKombat/MortalKombatPage.tsx`
- Modify: `src/features/mortalKombat/MortalKombatPage.test.tsx`

**Constraints:**
- Do not change tournament rules, registration, bracket, limit or RPC schema.
- Do not hide persistent failures; show a useful error and manual retry.
- Preserve the last valid projection on later failures.
- Prevent overlapping loads and clean up timers/subscriptions.

### Task 1: Recover the dedicated phone arena

- [ ] RED: add a fake-timer test where the initial load rejects, a bounded recovery tick reloads, and the page reaches the active signup state without remounting.
- [ ] RED: add a manual `ПОВТОРИТЬ` test that recovers immediately from the full-page error.
- [ ] RED: add tests for missed-realtime polling from idle to active, in-flight deduplication, timer/subscription cleanup and last-valid-state preservation on a later failure.
- [ ] GREEN: implement one guarded `reload` callback, 2-second recovery/idle polling and 10-second active-state convergence polling.
- [ ] GREEN: add the accessible retry button; keep `42501` registration guidance distinct from transport/payload errors.
- [ ] Run `npm test -- --run src/features/mortalKombat/MortalKombatPage.test.tsx`, full Vitest and typecheck.
- [ ] Commit `fix: recover MK phone page after transient load failure`.
