# Guest Hub + Timed Live Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/join` into a persistent guest hub and make Live Quiz run as a server-authoritative 30-second voting phase followed by a 30-second results phase with admin early-close controls and history.

**Architecture:** Extend the existing quiz state machine rather than create a parallel one. Persist timed quiz rounds in Postgres, make RPC reads normalize expired phases, expose phase deadlines/history through existing service boundaries, then embed the same quiz presentation logic inside the guest hub and `/play`. Admin controls operate on the same round state and can hide Quiz from the shared TV without destroying round data.

**Tech Stack:** React + TypeScript + Vitest + Supabase/Postgres RPC + Supabase Realtime + existing CSS visual system + Playwright for the single final package E2E gate.

**Spec:** `docs/superpowers/specs/2026-08-19-guest-hub-live-quiz-design.md`

## Global Constraints

- `/join` remains the canonical guest route and guest identity remains device-bound; no guest email/password accounts.
- Voting default duration is exactly 30 seconds; results default duration is exactly 30 seconds.
- Server timestamps are authoritative; clients render remaining time from `phaseEndsAt - now`.
- Realtime is only a fast refresh signal; correctness must not depend on a Realtime message arriving.
- Existing `/play` remains compatible and reuses the shared guest quiz model/presentation.
- Existing projector priority remains Bunker > Premiere > explicitly shared MK > Quiz > carriage arrival/call > idle registration.
- Package 1 does not implement MK hub integration or Bunker quest gameplay.
- During implementation run only targeted tests plus typecheck after each coherent slice; run the full suite/build/database validation/Playwright once before merge.

---

### Task 1: Persist timed quiz rounds and authoritative phase transitions

**Files:**
- Create: `supabase/migrations/202608190001_timed_quiz_rounds.sql`
- Modify through replacement definitions in the same migration: existing RPCs `owner_get_quiz_control`, `owner_activate_quiz_question`, `owner_reveal_quiz_results`, `get_quiz_state`, `get_quiz_screen_state`, `submit_quiz_vote`
- Create: `supabase/tests/quiz_timed_rounds.sql`

**Interfaces:**
- Produces persisted table `public.quiz_rounds` with `id`, `event_id`, `question_id`, `phase`, `voting_started_at`, `voting_ends_at`, `results_started_at`, `results_ends_at`, `closed_at`.
- Produces helper `public._normalize_current_quiz_round(p_event_id uuid) returns uuid` which advances expired `voting -> results -> closed` transactionally and keeps `quiz_state` compatible.
- Produces owner RPCs `owner_close_quiz_round(p_event_id uuid)` and `owner_return_quiz_to_main_screen(p_event_id uuid)`; the latter changes presentation routing only.
- Extends state projections with `roundId`, `phaseStartedAt`, `phaseEndsAt`.

- [ ] **Step 1: Write failing pgTAP coverage**

Add tests that seed one event, one guest, one standard question and assert:

```sql
select is(
  (public.owner_activate_quiz_question(:event_id, :question_id)->>'phase')::text,
  'voting',
  'activation starts voting'
);

select ok(
  (public.owner_get_quiz_control(:event_id)->>'phaseEndsAt') is not null,
  'owner projection exposes voting deadline'
);

update public.quiz_rounds
set voting_ends_at = now() - interval '1 second'
where event_id = :event_id and closed_at is null;

select is(
  (public.get_quiz_state('liza-viktor', :device_key)->>'phase')::text,
  'results',
  'guest read normalizes expired voting to results'
);

select throws_ok(
  $$ select public.submit_quiz_vote('liza-viktor', :device_key, :question_id, 'liza') $$,
  'P0001',
  'QUIZ_VOTING_CLOSED',
  'late vote is rejected by the server'
);
```

Also assert results expiry closes the round, clears active quiz ownership, and completed rounds remain queryable.

- [ ] **Step 2: Run only the SQL test to verify RED**

Run with the repository's existing Supabase test command, scoped to `supabase/tests/quiz_timed_rounds.sql` if the script supports a file argument; otherwise run only database tests. Expected: FAIL because `quiz_rounds` and deadline fields do not exist.

- [ ] **Step 3: Implement the migration**

Create `quiz_rounds` with one active round per event using a partial unique index:

```sql
create table public.quiz_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  phase text not null check (phase in ('voting','results','closed')),
  voting_started_at timestamptz not null,
  voting_ends_at timestamptz not null,
  results_started_at timestamptz,
  results_ends_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index quiz_rounds_one_open_per_event
on public.quiz_rounds(event_id)
where closed_at is null;
```

`owner_activate_quiz_question` creates a new round with `voting_ends_at = now() + interval '30 seconds'`. `_normalize_current_quiz_round` advances an expired voting round to results with `results_ends_at = now() + interval '30 seconds'`, or closes an expired results round and sets `quiz_state.phase = 'idle'` / current question null. `submit_quiz_vote` calls normalization first and raises `QUIZ_VOTING_CLOSED` unless the normalized phase is still `voting` and `now() < voting_ends_at`.

`owner_reveal_quiz_results` becomes the manual `voting -> results` transition and starts a fresh 30-second results deadline. `owner_close_quiz_round` closes immediately. `owner_return_quiz_to_main_screen` only toggles the existing presentation ownership flag/state used by the projector router and must not delete votes/rounds.

- [ ] **Step 4: Run database tests and type-independent validation**

Expected: timed-round pgTAP PASS and existing quiz SQL tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add timed live quiz rounds`

---

### Task 2: Extend TypeScript quiz service contracts for deadlines and history

**Files:**
- Modify: `src/features/quiz/quiz.service.ts`
- Modify: `src/features/quiz/quiz.service.test.ts`
- Modify: `src/features/quiz/adminQuiz.service.ts`
- Modify: `src/features/quiz/adminQuiz.service.test.ts`

**Interfaces:**
- `GuestQuizState` active variants gain `roundId: string`, `phaseStartedAt: string`, `phaseEndsAt: string`.
- Add `QuizHistoryEntry` with `roundId`, `questionId`, `questionText`, `questionType`, `closedAt`, `answeredCount`, `results`, `selectedChoice` for guest projection where available.
- `AdminQuizControl` gains the same timing fields when active and `history: AdminQuizHistoryEntry[]` in every phase.
- Add service functions `closeOwnerQuizRound(client,eventId)` and `returnOwnerQuizToMainScreen(client,eventId)`.

- [ ] **Step 1: Write failing parser tests**

Add fixtures that include ISO timestamps and history arrays and assert exact parsed values. Add one invalid timestamp case that must throw `Unexpected quiz timestamp`.

- [ ] **Step 2: Run targeted service tests to verify RED**

Run: `npm test -- src/features/quiz/quiz.service.test.ts src/features/quiz/adminQuiz.service.test.ts`
Expected: FAIL because new fields/functions are missing.

- [ ] **Step 3: Implement parsers and RPC wrappers**

Use a helper:

```ts
function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('Unexpected quiz timestamp');
  }
  return value;
}
```

Map `owner_close_quiz_round` and `owner_return_quiz_to_main_screen` without adding alternate state machines.

- [ ] **Step 4: Run targeted tests + typecheck**

Run: `npm test -- src/features/quiz/quiz.service.test.ts src/features/quiz/adminQuiz.service.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: expose timed quiz state to clients`

---

### Task 3: Build shared countdown and embedded guest quiz card

**Files:**
- Create: `src/features/quiz/QuizPhaseTimer.tsx`
- Create: `src/features/quiz/QuizPhaseTimer.test.tsx`
- Create: `src/features/quiz/GuestLiveQuizCard.tsx`
- Create: `src/features/quiz/GuestLiveQuizCard.test.tsx`
- Modify: `src/features/quiz/GuestQuizPage.tsx`
- Modify: `src/features/quiz/GuestQuizPage.test.tsx`
- Modify: `src/styles/quiz.css`

**Interfaces:**
- `QuizPhaseTimer({ endsAt, onExpire, now? })` renders `MM:SS`, clamps at `00:00`, calls `onExpire` once.
- `GuestLiveQuizCard` consumes an active `GuestQuizState`, `submitting`, `error`, `onVote`, and `onDeadline` and renders voting/results without owning data loading.
- `GuestQuizPage` keeps `/play` compatibility by reusing `GuestLiveQuizCard`.

- [ ] **Step 1: Write failing timer tests**

Use fake current time only inside this focused unit test. Assert a deadline 18 seconds away renders `00:18`, reaching deadline renders `00:00`, and `onExpire` fires once.

- [ ] **Step 2: Write failing guest-card tests**

Assert voting shows two enabled answers and countdown; selected answer locks; results show percentages and second countdown; error remains visible without removing content.

- [ ] **Step 3: Run only these tests to verify RED**

Run: `npm test -- src/features/quiz/QuizPhaseTimer.test.tsx src/features/quiz/GuestLiveQuizCard.test.tsx`
Expected: FAIL because components do not exist.

- [ ] **Step 4: Implement components and refactor `/play`**

Keep vote ownership in `GuestQuizPage`; extract only presentation. On deadline, reload authoritative state instead of locally forcing a phase.

- [ ] **Step 5: Run targeted tests + typecheck**

Run: `npm test -- src/features/quiz/QuizPhaseTimer.test.tsx src/features/quiz/GuestLiveQuizCard.test.tsx src/features/quiz/GuestQuizPage.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add shared timed guest quiz card`

---

### Task 4: Turn `/join` into the persistent Guest Hub

**Files:**
- Create: `src/features/guest/GuestHub.tsx`
- Create: `src/features/guest/GuestHub.test.tsx`
- Create: `src/features/guest/GuestLiveActivity.tsx`
- Create: `src/features/guest/GuestLiveActivity.test.tsx`
- Create: `src/features/guest/useGuestQuizLiveState.ts`
- Create: `src/features/guest/useGuestQuizLiveState.test.tsx`
- Modify: `src/features/registration/JoinPage.tsx`
- Modify: `src/features/registration/JoinPage.test.tsx`
- Modify: `src/styles/wedding-registration.css`

**Interfaces:**
- `GuestHub` receives `guest`, `activeCall`, quiz live-state projection/history, and existing secondary activity links.
- `useGuestQuizLiveState` owns `load -> Realtime refresh -> deadline refresh -> focus refresh`, reusing the existing device key.
- `GuestLiveActivity` priority in package 1 is carriage-call urgent banner first, then active Live Quiz card, then idle status. Later MK/Bunker can extend this selector without changing `GuestHub`.

- [ ] **Step 1: Write failing hub tests**

Assert a restored guest sees ticket + `СЕЙЧАС ПРОИСХОДИТ` + activities/history sections. Assert an active quiz fixture appears inside the hub without navigation. Assert an idle fixture keeps the ticket and shows waiting state.

- [ ] **Step 2: Write failing live-state hook tests**

Provide fake dependencies and assert: initial load; Realtime callback reload; phase deadline schedules reload; `visibilitychange`/focus reloads when tab becomes active.

- [ ] **Step 3: Run targeted tests to verify RED**

Run: `npm test -- src/features/guest/GuestHub.test.tsx src/features/guest/GuestLiveActivity.test.tsx src/features/guest/useGuestQuizLiveState.test.tsx src/features/registration/JoinPage.test.tsx`
Expected: FAIL because hub/hook are missing.

- [ ] **Step 4: Implement hub and integrate `JoinPage`**

When `guest` exists, `JoinPage` renders `GuestHub` rather than a ticket-only `RegistrationPage` + detached MK action. Registration/recovery screens remain unchanged for unregistered guests. Reuse the existing `VirtualTicket` through the same registration presentation contract.

- [ ] **Step 5: Add wedding-editorial mobile styles**

390px is the primary layout. The active quiz card must be above secondary actions and usable one-handed. Avoid horizontal scrolling.

- [ ] **Step 6: Run targeted tests + typecheck**

Run the four tests from Step 3 plus `npm run typecheck`.
Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add persistent guest event hub`

---

### Task 5: Add admin 30/30 controls, early close, return-to-main, and history

**Files:**
- Modify: `src/features/admin/quiz/AdminQuizPanel.tsx`
- Modify: `src/features/admin/quiz/AdminQuizPanel.test.tsx`
- Create: `src/features/admin/quiz/AdminQuizLiveControl.tsx`
- Create: `src/features/admin/quiz/AdminQuizLiveControl.test.tsx`
- Create: `src/features/admin/quiz/AdminQuizHistory.tsx`
- Create: `src/features/admin/quiz/AdminQuizHistory.test.tsx`
- Modify: `src/features/admin/AdminPage.tsx`
- Modify: `src/features/admin/AdminPage.quiz.test.tsx`
- Modify: `src/styles/admin.css` or the existing quiz-specific admin stylesheet if present

**Interfaces:**
- Extend `AdminQuizPanelDependencies` with `close(eventId)`, `returnMain(eventId)`, and existing `broadcastRefresh()`.
- `AdminQuizLiveControl` consumes active control state and exposes buttons:
  - voting: `ЗАКРЫТЬ ОТВЕТЫ СЕЙЧАС`, `ВЕРНУТЬ ОСНОВНОЙ ЭКРАН`
  - results: `ЗАКРЫТЬ ВОПРОС`, `СЛЕДУЮЩИЙ ВОПРОС`, `ВЕРНУТЬ ОСНОВНОЙ ЭКРАН`
- `AdminQuizHistory` is read-only newest-first history.

- [ ] **Step 1: Write failing admin-control tests**

Assert exact button availability per phase, 30-second timer rendering from `phaseEndsAt`, early close calls the correct dependency then reloads/broadcasts, and history rows show total plus Liza/Viktor percentages.

- [ ] **Step 2: Run targeted admin tests to verify RED**

Run: `npm test -- src/features/admin/quiz/AdminQuizLiveControl.test.tsx src/features/admin/quiz/AdminQuizHistory.test.tsx src/features/admin/quiz/AdminQuizPanel.test.tsx src/features/admin/AdminPage.quiz.test.tsx`
Expected: FAIL because controls/dependencies are missing.

- [ ] **Step 3: Implement controls and dependencies**

Wire `closeOwnerQuizRound` and `returnOwnerQuizToMainScreen` in `createAdminPageDependencies`. `СЛЕДУЮЩИЙ ВОПРОС` closes the current round if active, chooses the next enabled non-completed question by `sortOrder`, activates it, broadcasts one refresh, then reloads.

- [ ] **Step 4: Run targeted tests + typecheck**

Run the tests from Step 2 plus `npm run typecheck`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add timed quiz owner controls and history`

---

### Task 6: Put the same deadlines on the shared TV and honor return-to-main presentation routing

**Files:**
- Modify: `src/features/screen/QuizScreenScene.tsx`
- Modify: `src/features/screen/QuizScreenScene.test.tsx`
- Modify: `src/features/screen/ScreenPage.tsx` only if the current Quiz ownership flag needs to be consumed there; do not alter the priority ordering
- Modify: `src/styles/quiz.css`

**Interfaces:**
- TV voting scene renders question + answered count + `QuizPhaseTimer`.
- TV results scene renders percentages + results countdown.
- A hidden-from-main Quiz round remains active for phones/admin but no longer claims the TV until another owner action presents Quiz again.

- [ ] **Step 1: Write failing TV tests**

Assert voting and results both show the server deadline timer. Assert a quiz state marked not-presented does not render the Quiz scene through the existing screen router while other priorities remain unchanged.

- [ ] **Step 2: Run targeted screen tests to verify RED**

Run: `npm test -- src/features/screen/QuizScreenScene.test.tsx src/features/screen/ScreenPage.test.tsx`
Expected: FAIL on missing timer/presentation behavior.

- [ ] **Step 3: Implement TV timer and presentation handling**

Reuse `QuizPhaseTimer`; do not duplicate countdown logic. Do not add a new projector state machine.

- [ ] **Step 4: Run targeted tests + typecheck**

Run the tests from Step 2 plus `npm run typecheck`.
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: sync timed quiz presentation to tv`

---

### Task 7: Final package verification and merge readiness

**Files:**
- Modify: `e2e/event-day-critical.spec.ts` or the repository's current event-day E2E spec containing registration/quiz flows
- No production files unless verification finds a real defect

**Interfaces:**
- Final E2E proves registration -> restored hub -> live quiz auto-appears -> vote -> manual/automatic results -> close -> history, while existing event-critical flows still pass.

- [ ] **Step 1: Add one focused end-to-end scenario for the package**

The scenario must register a guest, keep `/join` open, activate a question from admin, verify it appears without manual navigation, submit a vote, verify a late second vote is impossible, reveal/expire results, close the round, then verify the guest returns to hub and admin history contains the round.

- [ ] **Step 2: Run the one final merge-gate verification set**

Run once on the final head:

```bash
npm test
npm run typecheck
npm run build
# repository Supabase database test/migration command
# repository Playwright E2E command
```

Expected: all unit tests PASS, typecheck PASS, build PASS, database validation PASS, full Playwright PASS.

- [ ] **Step 3: Review scope**

Compare branch to `main`. Confirm no MK gameplay, Bunker gameplay, guest account/email system, or unrelated projector priority changes are present.

- [ ] **Step 4: Commit E2E coverage**

Commit message: `test: cover guest hub timed live quiz flow`

- [ ] **Step 5: Open/update PR**

PR title: `feat: add guest hub and timed live quiz`

PR body must state the exact final verification counts/results and note that full E2E was intentionally run once as the merge gate, per the approved faster-development workflow.
