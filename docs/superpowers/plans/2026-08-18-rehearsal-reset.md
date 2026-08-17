# Rehearsal Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner repeatedly rehearse the wedding app with fake runtime data and atomically restore the event to a clean pre-arrival state while preserving prepared content and locked couple pre-answers.

**Architecture:** One owner-only Supabase RPC performs the entire reset transaction and returns deletion counts for the confirmation/success UI. Runtime tables are cleared/reset explicitly; protected configuration and locked joint couple-answer tables are never included in destructive statements. The admin UI first loads a reset preview, requires the exact confirmation phrase, then invokes the RPC and refetches all affected realtime state.

**Tech Stack:** React, TypeScript, Supabase PostgreSQL/RLS/RPC, Vitest, Testing Library, pgTAP/Supabase DB tests.

## Global Constraints

- Only `events.owner_user_id` may execute rehearsal reset.
- Confirmation phrase is exactly `СБРОСИТЬ РЕПЕТИЦИЮ`.
- Reset must be one database transaction; partial reset is forbidden.
- Preserve question bank/media and locked joint Liza + Viktor pre-answers.
- Preserve carriage definitions/colors, event dates/configuration and premiere media reference.
- Clear guests, guest bindings, guest votes, final-five live answers, carriage calls, screen-event runtime queue, MK runtime state and premiere runtime state.
- Screen returns to `idle` after success.
- After reset, a previously used rehearsal phone can register again as a new guest.

---

### Task 1: Add reset preview and protected transactional RPC

**Files:**
- Create: `supabase/migrations/006_rehearsal_reset.sql`
- Create: `supabase/tests/rehearsal_reset.sql`

**Interfaces:**
- `owner_rehearsal_reset_preview(event_id uuid) -> jsonb`
- `owner_rehearsal_reset(event_id uuid, confirmation text) -> jsonb`

- [ ] **Step 1: Write failing DB tests**

Test that preview returns counts, anonymous/Liza/Viktor calls fail, incorrect confirmation fails, and a seeded locked `couple_answer_sets`/`couple_quiz_answers` snapshot remains unchanged after reset.

- [ ] **Step 2: Run DB tests and verify RED**

Run: `supabase db reset && supabase test db`
Expected: FAIL because reset RPCs do not exist.

- [ ] **Step 3: Implement preview RPC**

Return explicit counts for guests, votes, live couple answers, MK participants/matches, carriage calls and screen events without mutating state.

- [ ] **Step 4: Implement atomic reset RPC**

Inside one protected function/transaction:

1. verify `auth.uid() = events.owner_user_id`;
2. verify confirmation text exactly;
3. capture deletion counts;
4. clear dependent runtime rows in FK-safe order;
5. reset event/screen/premiere runtime fields to idle/default;
6. do not touch questions, question media, `couple_answer_sets`, `couple_quiz_answers`, carriages, event configuration or media items;
7. insert one final owner audit record with counts;
8. return counts and `screen_mode: 'idle'`.

- [ ] **Step 5: Run DB tests and verify GREEN**

Run: `supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_rehearsal_reset.sql supabase/tests/rehearsal_reset.sql
git commit -m "feat: add protected rehearsal reset transaction"
```

---

### Task 2: Add owner reset preview/confirmation UI

**Files:**
- Create: `src/features/admin/reset/rehearsalReset.service.ts`
- Create: `src/features/admin/reset/RehearsalResetPanel.tsx`
- Create: `src/features/admin/reset/RehearsalResetPanel.test.tsx`
- Modify: `src/features/admin/AdminShell.tsx`

**Interfaces:**
- `getRehearsalResetPreview(eventId)`
- `runRehearsalReset(eventId, confirmation)`

- [ ] **Step 1: Write failing UI tests**

Verify the panel shows destructive counts and preserved items, keeps the execute button disabled until the exact confirmation phrase is entered, and never offers an option to delete locked couple answers.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/admin/reset`
Expected: FAIL.

- [ ] **Step 3: Implement preview UI**

Render sections:

`БУДЕТ УДАЛЕНО` with live counts and `БУДЕТ СОХРАНЕНО` with questions/images, locked couple answers, carriages/colors, premiere video and settings.

- [ ] **Step 4: Implement confirmation and success state**

Require exact input `СБРОСИТЬ РЕПЕТИЦИЮ`, call the RPC once, block duplicate submits, then show `РЕПЕТИЦИЯ СБРОШЕНА — Система готова к новой проверке.` and invalidate/refetch runtime queries.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/admin/reset`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/reset src/features/admin/AdminShell.tsx
git commit -m "feat: add rehearsal reset admin controls"
```

---

### Task 3: Verify cross-module reset behavior

**Files:**
- Create: `src/features/admin/reset/rehearsalReset.integration.test.ts`
- Modify tests in guest, quiz, tournament and screen modules only where needed to expose reset fixtures.

**Interfaces:**
- Reuse the reset RPC through the service boundary; do not duplicate delete logic in frontend tests.

- [ ] **Step 1: Seed a realistic rehearsal state**

Fixture includes registered guests/device keys/tickets, guest votes, final-five live answers, active carriage call, queued screen moments, 16-player MK bracket/results and armed premiere runtime state plus locked normal-quiz couple pre-answers.

- [ ] **Step 2: Assert post-reset state**

Expect zero runtime guest/module rows, idle screen state, no active premiere timestamp, and the exact same locked pre-answer IDs/values/`locked_at` timestamps.

- [ ] **Step 3: Verify old rehearsal device can register anew**

The same device key/local client after reset follows the normal new-registration flow rather than restoring a deleted rehearsal guest.

- [ ] **Step 4: Run full relevant suite**

Run: `npm run typecheck && npm test -- src/features/admin/reset src/features/guest src/features/quiz src/features/tournament src/features/screen && supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src supabase
git commit -m "test: verify full rehearsal reset flow"
```

---

## Self-Review

- Spec coverage: destructive preview, exact phrase, atomic owner-only reset, runtime-data scope, preserved locked preanswers/questions/configuration, idle screen restoration and repeat rehearsal are all covered.
- Placeholder scan: no TBD/TODO implementation placeholders.
- Type consistency: preview/reset services return the same count keys used by UI and integration tests.
