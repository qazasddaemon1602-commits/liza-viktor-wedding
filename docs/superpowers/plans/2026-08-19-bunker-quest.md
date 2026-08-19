# Bunker Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Bunker emergency takeover into a complete 30-minute carriage-based digital quest with personal dossiers, two team missions, a shared final code, owner controls, guest-cabinet integration, and TV progress scenes.

**Architecture:** Keep `bunker_state` as the authoritative event runtime/timer and add persisted quest phase, guest dossiers, mission templates, and carriage progress behind security-definer RPCs. Guest phones, owner admin, and TV consume the same authoritative state and use the existing Bunker refresh channel only as an invalidation signal.

**Tech Stack:** React 19, TypeScript 7, Supabase/Postgres RPC + RLS, Supabase Realtime broadcast, Vitest/Testing Library, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-19-bunker-quest-design.md`

## Global Constraints

- Bunker remains the highest shared-screen priority.
- Global timer starts with the emergency trigger and stays active at `00:00` until owner STOP.
- No traitors, no guest elimination, no separate guest login.
- Carriage is the team; five carriages share one run.
- Guest Bunker content appears automatically inside the persistent guest cabinet.
- Realtime messages contain refresh signals only; backend state is authoritative.
- Late guests receive a stable dossier without resetting existing team progress.
- During implementation run only focused tests/typecheck; run full CI/database/E2E once at the final PR merge gate.

---

### Task 1: Persisted Bunker quest state and content

**Files:**
- Create: `supabase/migrations/202608190002_bunker_quest_core.sql`
- Create: `supabase/tests/bunker_quest_core.sql`
- Modify: `supabase/migrations/202608180024_reset_includes_bunker.sql` only through a new follow-up migration; never rewrite applied history.

**Interfaces:**
- Produces event-level phases: `emergency | dossier_1 | dossier_2 | mission_a | mission_b | final | completed`.
- Produces `bunker_guest_profiles`, `bunker_mission_templates`, `bunker_team_progress`.
- Produces guest RPCs `get_guest_bunker_state`, `submit_guest_bunker_mission`, `submit_guest_bunker_final_code`.
- Produces owner RPCs `owner_get_bunker_quest`, `owner_begin_bunker_quest`, `owner_advance_bunker_phase`, `owner_reset_bunker_team_stage`, `owner_force_complete_bunker_team_stage`, `owner_unlock_bunker`.

- [ ] **Step 1: Add failing pgTAP contract tests**

Test that direct table access is unavailable to anon/authenticated, guest RPC requires a valid device binding, owner RPC rejects non-owner auth, phase transitions are explicit, wrong mission answers do not complete a carriage, correct Mission B unlocks a fragment, and the final code atomically unlocks the run.

```sql
select throws_ok(
  $$ select public.owner_begin_bunker_quest('00000000-0000-0000-0000-000000000000'::uuid) $$,
  '42501',
  'owner access required'
);

select is(
  (public.get_guest_bunker_state('liza-viktor', 'invalid-device')->>'status'),
  'guest_not_found',
  'unknown device cannot read Bunker dossier'
);
```

- [ ] **Step 2: Run only Bunker database tests and verify RED**

Run via the repository database-test harness against the new pgTAP file. Expected failure: missing Bunker quest tables/RPCs.

- [ ] **Step 3: Implement the migration**

Extend `bunker_state` with `phase`, `phase_started_at`, `unlocked_at`, and `run_nonce`. Create the three quest tables with RLS enabled and revoke direct access. Seed six safe content pools and exactly ten mission templates (two stages × five carriages). Store final fragments/code server-side and never include the real full code in guest/TV state.

Guest state response shape:

```json
{
  "status": "active",
  "phase": "mission_a",
  "serverNow": "...",
  "remainingSeconds": 1234,
  "dossier": {
    "profession": "...",
    "profile": "...",
    "health": null,
    "hobby": null,
    "baggage": null,
    "hiddenFact": null
  },
  "team": {
    "carriageNumber": 3,
    "mission": { "stage": "mission_a", "title": "...", "prompt": "...", "options": [] },
    "completed": false,
    "fragment": null
  },
  "final": { "unlocked": false }
}
```

- [ ] **Step 4: Make generation stable and late-guest-safe**

`get_guest_bunker_state` lazily inserts one profile for the current guest/run using server-side random pool selection when none exists. Use a unique constraint on `(run_nonce, guest_id)` so refresh/reconnect cannot reroll the profile.

- [ ] **Step 5: Run focused pgTAP and verify GREEN**

Expected: all Bunker quest database assertions pass.

- [ ] **Step 6: Commit**

Commit message: `feat: add persisted Bunker quest state`.

---

### Task 2: TypeScript service and realtime contract

**Files:**
- Modify: `src/features/bunker/bunker.service.ts`
- Modify: `src/features/bunker/bunker.service.test.ts`
- Modify: `src/features/bunker/bunker.realtime.ts`
- Create: `src/features/bunker/bunkerQuest.types.ts`
- Create: `src/features/bunker/bunkerQuest.service.test.ts`

**Interfaces:**
- Produces `GuestBunkerQuestState`, `OwnerBunkerQuestState`, `BunkerPhase`.
- Produces `getGuestBunkerQuest`, `submitBunkerMission`, `submitBunkerFinalCode`, `getOwnerBunkerQuest`, `beginBunkerQuest`, `advanceBunkerPhase`, `resetBunkerTeamStage`, `forceCompleteBunkerTeamStage`, `unlockBunker`.

- [ ] **Step 1: Write failing parser/service tests**

```ts
expect(parseGuestBunkerQuest(fixture)).toMatchObject({
  status: 'active',
  phase: 'mission_a',
  team: { carriageNumber: 3, completed: false },
});
```

Also test that hidden dossier fields remain `null` before reveal phases and malformed timestamps/phases throw.

- [ ] **Step 2: Run only Bunker service tests and verify RED**

Run Vitest for `src/features/bunker/*Quest*.test.ts` and `bunker.service.test.ts`.

- [ ] **Step 3: Implement strict parsers and RPC wrappers**

Keep existing emergency API signatures compatible. New wrappers accept existing event slug/device key or event id and return typed state only.

- [ ] **Step 4: Verify Realtime remains refresh-only**

Reuse `broadcastBunkerRefresh`/subscription; do not add dossier, answer, fragment, or code data to broadcasts.

- [ ] **Step 5: Run focused tests + `npm run typecheck`**

Expected: focused Bunker service tests pass and TypeScript has zero errors.

- [ ] **Step 6: Commit**

Commit message: `feat: add Bunker quest client contract`.

---

### Task 3: Guest cabinet Bunker takeover

**Files:**
- Modify: `src/features/registration/GuestJoinPage.tsx`
- Modify: `src/features/guest/GuestHub.tsx`
- Modify: `src/features/guest/GuestLiveActivity.tsx`
- Create: `src/features/bunker/GuestBunkerQuest.tsx`
- Create: `src/features/bunker/GuestBunkerQuest.test.tsx`
- Modify: `src/styles/guest-hub.css`
- Modify/Create: `src/styles/bunker-quest.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes `getGuestBunkerQuest`, `submitBunkerMission`, `submitBunkerFinalCode`.
- Bunker activity priority on phone: Bunker > carriage call > Quiz > idle.

- [ ] **Step 1: Write failing guest UI tests**

Cover emergency automatic appearance, phase-locked dossier rows, reveal updates, carriage mission submission, fragment display, final-code input, unlocked state, and return to normal cabinet after Bunker stop.

```tsx
expect(screen.getByRole('region', { name: 'Бункер' })).toHaveTextContent('ПОЕЗД ИЗМЕНИЛ МАРШРУТ');
expect(screen.getByText('ПРОФЕССИЯ')).toBeVisible();
expect(screen.getByText('СКРЫТО ДО КОМАНДЫ ВЕДУЩЕГО')).toBeVisible();
```

- [ ] **Step 2: Run focused guest tests and verify RED**

Run only `GuestBunkerQuest.test.tsx` plus existing GuestHub/Join tests.

- [ ] **Step 3: Wire GuestJoinPage to Bunker state**

After guest restore/register, load Bunker state with the same device key. Subscribe to Bunker refresh and use a modest polling fallback while active. Deadline/timer is derived from server time, not a new client 30-minute timer.

- [ ] **Step 4: Implement GuestBunkerQuest**

Render one component by phase:
- emergency notice;
- dossier I;
- dossier II;
- Mission A/B form with shared carriage completion;
- fragment card;
- final code terminal;
- unlocked/arrival state.

Wrong mission/final answers remain retryable and display a short inline response without navigation.

- [ ] **Step 5: Apply archive/observatory mobile styling**

Use black/warm off-white, mono micro-labels, serif/condensed display typography, technical rules and dossier stamps. Avoid neon/red HUD styling.

- [ ] **Step 6: Run focused tests + typecheck**

Expected: GuestHub/Join/Bunker guest tests pass and typecheck is clean.

- [ ] **Step 7: Commit**

Commit message: `feat: bring Bunker quest into guest cabinet`.

---

### Task 4: Owner Bunker quest console

**Files:**
- Modify: `src/features/admin/bunker/AdminBunkerControl.tsx`
- Modify/Create: `src/features/admin/bunker/AdminBunkerControl.test.tsx`
- Modify: `src/styles/admin.css` or create `src/styles/admin-bunker-quest.css`
- Modify: `src/main.tsx` if a new stylesheet is created.

**Interfaces:**
- Consumes owner Bunker quest RPC wrappers from Task 2.
- Existing start/restart/stop/sound controls remain available.

- [ ] **Step 1: Write failing owner-console tests**

Test current phase, five carriage cards, `НАЧАТЬ КВЕСТ`, reveal/next-phase controls, all-ready indicator, per-carriage reset/force complete, final manual unlock, and STOP.

- [ ] **Step 2: Run only Admin Bunker tests and verify RED**

- [ ] **Step 3: Expand AdminBunkerControl without creating a second owner page**

Owner actions call RPC first, broadcast refresh second, reload authoritative state third. If broadcast fails after a successful RPC, show a warning but never repeat the mutation automatically.

- [ ] **Step 4: Make pacing manual**

All-carriages-complete only enables/highlights the next phase. It does not auto-advance, preserving host timing.

- [ ] **Step 5: Run focused admin tests + typecheck**

- [ ] **Step 6: Commit**

Commit message: `feat: add Bunker quest owner console`.

---

### Task 5: Shared-TV Bunker scenes

**Files:**
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`
- Modify: `src/features/bunker/BunkerEmergencyScene.tsx`
- Create: `src/features/bunker/BunkerQuestScene.tsx`
- Create: `src/features/bunker/BunkerQuestScene.test.tsx`
- Modify: `src/styles/bunker.css`

**Interfaces:**
- `BunkerScreenGuard` remains the protection boundary and consumes authoritative screen/quest state.
- TV never receives the secret full code or unrevealed dossier values.

- [ ] **Step 1: Write failing scene tests**

Verify emergency copy/timer, mission board with five carriage progress markers, final locked slots, early-unlock waiting state, `00:00` unlocked/locked arrival variants, and Bunker protection over child content.

- [ ] **Step 2: Run focused screen tests and verify RED**

- [ ] **Step 3: Add phase-specific scene rendering**

Keep the timer visible in every active phase. At `00:00`, render arrival state but do not unmount Bunker protection.

- [ ] **Step 4: Preserve audio semantics**

Alert audio remains tied to the initial emergency and existing sound-enabled control; phase changes must not restart alarm loops unexpectedly.

- [ ] **Step 5: Run focused Bunker screen tests + typecheck**

- [ ] **Step 6: Commit**

Commit message: `feat: add Bunker quest TV progress scenes`.

---

### Task 6: Reset, late guests, and operational fallbacks

**Files:**
- Create: `supabase/migrations/202608190003_bunker_quest_reset.sql`
- Modify: relevant reset pgTAP test file
- Modify: `src/features/admin/AdminPage.reset-factory.test.ts` only if returned reset metadata changes.

**Interfaces:**
- `owner_reset_event_test_data` deletes all Bunker quest run/profile/progress/final-attempt data and returns Bunker to idle while preserving couple preanswers.

- [ ] **Step 1: Add failing reset/late-guest database tests**

Create a run, create dossier/progress, reset event, assert quest rows are gone. Start another run, register/restore a late guest, call guest Bunker state and assert a dossier is created without changing completed carriage progress.

- [ ] **Step 2: Run focused database tests and verify RED**

- [ ] **Step 3: Add follow-up reset migration**

Do not edit old applied migration history. Replace `owner_reset_event_test_data` in a new migration and clear new tables in FK-safe order.

- [ ] **Step 4: Verify GREEN**

Run focused pgTAP. Then run Bunker reset unit tests if the frontend reset response changes.

- [ ] **Step 5: Commit**

Commit message: `fix: include Bunker quest in rehearsal reset`.

---

### Task 7: One final integration gate

**Files:**
- Create/Modify: `e2e/bunker-quest.spec.ts`
- Update: this plan checklist/status only if useful; do not create extra test-only PRs.

**Interfaces:**
- Exercises production paths through local Supabase, owner admin, guest cabinet, and shared screen.

- [ ] **Step 1: Add one focused multi-client E2E**

Scenario:
1. reset runtime;
2. register guests in at least two carriages;
3. login owner;
4. start Bunker and verify guest + TV emergency;
5. begin quest and verify stable dossiers;
6. reveal dossier II;
7. complete Mission A/B for the participating carriages (use owner force-complete for unrepresented carriages so the test stays bounded);
8. collect fragments through backend/guest-visible state without reading the stored secret directly from frontend code;
9. submit final code through a guest path or owner fallback and verify global unlock;
10. assert `00:00`/arrival logic in unit coverage rather than waiting 30 minutes in E2E;
11. stop Bunker and verify normal presentation returns;
12. reset and verify disposable quest data is cleared.

- [ ] **Step 2: Run targeted Bunker tests/typecheck locally/CI-equivalent where available**

Do not run full E2E between implementation tasks.

- [ ] **Step 3: Open one final PR**

The PR is the only full merge gate for this package. Let GitHub run full CI, database tests, and Playwright once.

- [ ] **Step 4: Fix only concrete merge-gate failures**

Do not add unrelated features or refactors during the gate.

- [ ] **Step 5: Merge after fresh green evidence**

Merge to `main`, then verify the deployed `/admin`, `/join`, and `/screen` Bunker flow with a short production smoke test.
