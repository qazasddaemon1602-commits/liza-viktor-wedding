# Quiz & Couple Answers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the live `Лиза или Виктор?` voting module, optional humorous question visuals, joint one-time couple pre-answers locked before the event, staged guest-result/couple-answer reveal, plus the separate final-five live couple round.

**Architecture:** Quiz content and vote state live in Supabase with RLS/RPC boundaries. Guest clients only receive the active question and public vote state; official couple pre-answers are never selected to public clients before the current question reaches the allowed reveal phase. The admin controls question lifecycle and screen state from the phone; projector presentation consumes the shared screen infrastructure.

**Tech Stack:** React, TypeScript, Supabase PostgreSQL/Realtime/Storage, Vitest, Testing Library.

## Global Constraints

- One vote per registered guest/device per question.
- A late guest can vote only while the current question is still open and unrevealed; past questions are never reopened automatically.
- Standard quiz questions use one **joint** Liza + Viktor official answer completed before the event.
- The joint answer set is editable only in draft; `ЗАФИКСИРОВАТЬ ОТВЕТЫ` permanently locks it and consumes the one-time capability.
- Normal admin UI must not provide an unlock/edit path for locked official answers and should show only completion/locked status before reveal.
- Public/projector clients must not fetch hidden official answers before reveal; CSS hiding is insufficient.
- Final five remain a separate live mechanic where Liza and Viktor answer independently/private during the event.
- Every question may have an optional small thematic image; image failure must never block text/voting.
- Question images live in deploy-safe media storage, not as large binaries in GitHub.
- All screens keep the restrained wedding palette and readable projector typography.

---

## File Structure

- `supabase/migrations/003_quiz.sql` — questions, votes, answer capabilities, joint pre-answer set, live couple answers, RPCs/RLS.
- `supabase/tests/quiz.sql` — hidden-answer and voting security tests.
- `src/features/quiz/quiz.types.ts` — question/vote/reveal types.
- `src/features/quiz/quiz.service.ts` — public guest quiz API/subscriptions.
- `src/features/quiz/GuestQuizPage.tsx` — guest voting experience.
- `src/features/quiz/QuestionCard.tsx` — question + optional image.
- `src/features/quiz/QuestionImage.tsx` — media fallback component.
- `src/features/quiz/CouplePreAnswerPage.tsx` — one-time joint draft/lock flow.
- `src/features/quiz/CouplePreAnswerLocked.tsx` — consumed access state.
- `src/features/quiz/LiveCoupleAnswerPage.tsx` — role-scoped Liza/Viktor final-five answers.
- `src/features/admin/quiz/AdminQuizControl.tsx` — question lifecycle/reveal control.
- `src/features/admin/quiz/AdminQuestionEditor.tsx` — CRUD/reorder/image media.
- `src/features/admin/quiz/CoupleAnswerStatus.tsx` — completion only.
- `src/features/screen/quiz/QuestionScreen.tsx` — open voting state.
- `src/features/screen/quiz/QuizResultScreen.tsx` — guest distribution.
- `src/features/screen/quiz/CoupleOfficialReveal.tsx` — joint official answer reveal.
- `src/features/screen/quiz/FinalFiveReveal.tsx` — independent Liza/Viktor reveal.

---

### Task 1: Create quiz schema, seeded questions, and secure vote lifecycle

**Files:**
- Create: `supabase/migrations/003_quiz.sql`
- Create: `supabase/tests/quiz.sql`
- Create: `src/features/quiz/quiz.types.ts`

**Interfaces:**
- Tables: `questions`, `votes`, `couple_answer_capabilities`, `couple_answer_sets`, `couple_quiz_answers`, `live_couple_answers`.
- Question types: `standard`, `final_five`.
- Reveal phases for standard: `open -> guest_results -> official_answer -> closed`.
- Reveal phases for final five: `open -> guest_results -> liza_answer -> viktor_answer -> verdict -> closed`.

- [ ] **Step 1: Write failing DB tests for vote uniqueness and hidden answers**

```sql
begin;
select plan(5);
select has_table('public', 'questions', 'questions exists');
select has_table('public', 'votes', 'votes exists');
select has_table('public', 'couple_quiz_answers', 'official answers exist');
select col_is_unique('public', 'votes', ARRAY['question_id','guest_id'], 'one vote per guest/question');
select throws_ok($$ select public.get_official_answer_for_question(gen_random_uuid()) $$, '42501', null, 'unrevealed official answer is inaccessible');
select * from finish();
rollback;
```

- [ ] **Step 2: Run and verify failure**

Run: `supabase db reset && supabase test db`
Expected: FAIL.

- [ ] **Step 3: Implement schema and state RPCs**

`questions` includes: `id`, `event_id`, `text`, `type`, `sort_order`, `enabled`, `image_path`, `image_alt`, `image_focus`, `required_preanswer`.

`submit_vote(event_id, question_id, guest_id, choice)` validates guest belongs to event, current question matches, reveal phase is `open`, then inserts exactly once.

- [ ] **Step 4: Seed standard questions and final five**

Seed at least these standard questions in editable order:

```text
Кто дольше собирается?
Кто первым мирится после ссоры?
Кто чаще говорит «Я же говорил»?
Кто скорее заведёт ещё одного питомца?
Кто переживёт зомби-апокалипсис?
Кто чаще делает спонтанные покупки?
Кто в доме главный?
Кто быстрее уснёт во время фильма?
Кто лучше готовит?
Кто скорее предложит заказать доставку?
Кто чаще теряет или ищет телефон?
Кто дольше выбирает фильм?
Кто лучше помнит даты?
Кто больше фотографирует в отпуске?
Кто спорит с навигатором?
Кто первым смеётся в неподходящий момент?
Кто более азартный?
Кто добровольно берёт микрофон в караоке?
Кто первым говорит «пора домой»?
Кто соберёт мебель без инструкции?
```

Final five exactly:

```text
Кто главный?
Кто первым мирится?
Кто транжира?
Кто заведёт ещё одно животное?
Кто кого больше избаловал?
```

- [ ] **Step 5: Run DB tests**

Run: `supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase src/features/quiz/quiz.types.ts
git commit -m "feat: add secure quiz data model"
```

---

### Task 2: Implement joint couple pre-answer draft and irreversible lock

**Files:**
- Create: `src/features/quiz/CouplePreAnswerPage.tsx`
- Create: `src/features/quiz/CouplePreAnswerPage.test.tsx`
- Create: `src/features/quiz/CouplePreAnswerLocked.tsx`
- Create: `src/features/quiz/couplePreAnswer.service.ts`
- Modify: `supabase/migrations/003_quiz.sql`
- Modify: `supabase/tests/quiz.sql`

**Interfaces:**
- One-time capability purpose: `couple_preanswer`.
- `saveDraftAnswer(capabilityToken, questionId, choice)` only while set status is `draft`.
- `lockCoupleAnswerSet(capabilityToken)` atomically validates completeness, locks set and consumes capability.

- [ ] **Step 1: Write lock behavior tests**

```ts
it('warns that final confirmation is irreversible', async () => {
  render(<CouplePreAnswerPage capability="valid" />);
  await user.click(screen.getByRole('button', { name: 'ЗАФИКСИРОВАТЬ ОТВЕТЫ' }));
  expect(screen.getByText(/после этого изменить их будет нельзя/i)).toBeInTheDocument();
});
```

DB tests must cover draft editing, incomplete-set lock rejection, atomic lock, Liza/Viktor post-lock update rejection and consumed-token reuse rejection.

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/quiz/CouplePreAnswerPage.test.tsx && supabase test db`
Expected: FAIL.

- [ ] **Step 3: Implement atomic lock RPC**

Pseudo-contract:

```sql
-- inside security-definer function with capability validation
if answer_count <> required_question_count then
  raise exception 'incomplete answer set';
end if;
update couple_answer_sets set status='locked', locked_at=now() where id=v_set_id and status='draft';
update couple_answer_capabilities set consumed_at=now(), enabled=false where id=v_capability_id;
```

Also add immutable policies/triggers rejecting updates/deletes to locked answer rows from normal app roles.

- [ ] **Step 4: Implement private UX**

Heading: `ВАША ВЕРСИЯ`.
Subcopy: `Ответьте вместе. Эти ответы увидят гости только во время игры.`
After consumed access: `ГОТОВО. ОТВЕТЫ ЗАФИКСИРОВАНЫ.` / `Увидимся на игре.` with no answer values.

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npm test -- src/features/quiz/CouplePreAnswerPage.test.tsx && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz supabase
git commit -m "feat: add locked joint couple preanswers"
```

---

### Task 3: Build guest voting UI and optional humorous question imagery

**Files:**
- Create: `src/features/quiz/quiz.service.ts`
- Create: `src/features/quiz/GuestQuizPage.tsx`
- Create: `src/features/quiz/GuestQuizPage.test.tsx`
- Create: `src/features/quiz/QuestionCard.tsx`
- Create: `src/features/quiz/QuestionImage.tsx`
- Create: `src/features/quiz/QuestionImage.test.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Guest sees current open question, optional image, `ЛИЗА` / `ВИКТОР`, own lock state and waiting state.
- Guest never receives official-answer payload before authorized reveal.

- [ ] **Step 1: Write guest behavior tests**

```tsx
it('locks the two choices after a successful vote', async () => {
  render(<GuestQuizPage />);
  await user.click(await screen.findByRole('button', { name: 'ЛИЗА' }));
  expect(screen.getByRole('button', { name: 'ЛИЗА' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'ВИКТОР' })).toBeDisabled();
});

it('keeps question text usable if image fails', () => {
  render(<QuestionImage src="broken" alt="Смешная иллюстрация" fallbackText="Кто транжира?" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Кто транжира?')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/quiz/GuestQuizPage.test.tsx src/features/quiz/QuestionImage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement live question subscription and vote service**

After vote persistence succeeds show the selected answer and `Ждём остальных…`. A persistence failure must restore tappable choices and show a concise retry state instead of falsely locking locally.

- [ ] **Step 4: Implement image layout/fallback**

Use consistent aspect ratio/crop. Image remains visually secondary to question text. Broken/slow images collapse to a neutral framed placeholder without changing voting logic.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/quiz`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz src/app/routes.tsx
git commit -m "feat: add live guest quiz voting"
```

---

### Task 4: Build owner question editor and live quiz control

**Files:**
- Create: `src/features/admin/quiz/AdminQuestionEditor.tsx`
- Create: `src/features/admin/quiz/AdminQuestionEditor.test.tsx`
- Create: `src/features/admin/quiz/AdminQuizControl.tsx`
- Create: `src/features/admin/quiz/AdminQuizControl.test.tsx`
- Create: `src/features/admin/quiz/CoupleAnswerStatus.tsx`
- Modify: `supabase/migrations/003_quiz.sql`

**Interfaces:**
- Owner controls: add/edit/delete/reorder/enable question; upload/replace/remove image; activate question; close voting; reveal guest result; reveal official answer; next/previous/reset.
- Admin sees joint pre-answer progress/locked status, not hidden values.

- [ ] **Step 1: Write admin-control tests**

```tsx
it('shows preanswer completion but not hidden answer values', () => {
  render(<CoupleAnswerStatus answered={20} total={20} locked />);
  expect(screen.getByText(/ответы зафиксированы/i)).toBeInTheDocument();
  expect(screen.queryByText(/ЛИЗА|ВИКТОР/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/admin/quiz`
Expected: FAIL.

- [ ] **Step 3: Implement owner question CRUD/media**

Upload files to the configured Supabase question-media bucket, save only storage path/alt/focus metadata in `questions`, and remove orphaned media only through owner actions.

- [ ] **Step 4: Implement live lifecycle controls**

`ПОКАЗАТЬ РЕЗУЛЬТАТ` moves standard question to `guest_results`; a separate `ПОКАЗАТЬ ОТВЕТ ЛИЗЫ И ВИКТОРА` moves to `official_answer`. Do not combine these server states even if animation timing is short.

- [ ] **Step 5: Run frontend/DB tests**

Run: `npm run typecheck && npm test -- src/features/admin/quiz && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/quiz supabase
git commit -m "feat: add owner quiz controls and media editing"
```

---

### Task 5: Add projector question/result/official-answer scenes and screen events

**Files:**
- Create: `src/features/screen/quiz/QuestionScreen.tsx`
- Create: `src/features/screen/quiz/QuestionScreen.test.tsx`
- Create: `src/features/screen/quiz/QuizResultScreen.tsx`
- Create: `src/features/screen/quiz/CoupleOfficialReveal.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`
- Modify: `src/features/screen/events/eventPriority.ts`

**Interfaces:**
- Open question shows question/image and `Ответили N / registeredEligible` only.
- Guest result shows counts/percentages.
- Official answer reveal fetches official answer only after `official_answer` state.

- [ ] **Step 1: Write reveal-order tests**

```tsx
it('does not render percentages before guest-results state', () => {
  render(<QuestionScreen question={q} answered={31} eligible={40} />);
  expect(screen.getByText('Ответили 31 / 40')).toBeInTheDocument();
  expect(screen.queryByText(/%/)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/screen/quiz`
Expected: FAIL.

- [ ] **Step 3: Implement presentation scenes**

Question typography must remain readable across a room. Optional image is larger than mobile but still secondary. Result reveal uses restrained motion, not confetti/game-show graphics.

- [ ] **Step 4: Generate contextual screen events**

On guest-result/official-answer comparison, queue one designed event such as `ГОСТИ УГАДАЛИ` or `ЛИЗА И ВИКТОР СЧИТАЮТ ИНАЧЕ` without interrupting a protected screen state.

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npm test -- src/features/screen/quiz src/features/screen/events`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen/quiz src/features/screen
git commit -m "feat: add projector quiz reveal flow"
```

---

### Task 6: Implement final-five live independent Liza/Viktor answers

**Files:**
- Create: `src/features/quiz/LiveCoupleAnswerPage.tsx`
- Create: `src/features/quiz/LiveCoupleAnswerPage.test.tsx`
- Create: `src/features/quiz/liveCouple.service.ts`
- Create: `src/features/screen/quiz/FinalFiveReveal.tsx`
- Create: `src/features/screen/quiz/FinalFiveReveal.test.tsx`
- Modify: `supabase/migrations/003_quiz.sql`
- Modify: `supabase/tests/quiz.sql`

**Interfaces:**
- Liza and Viktor submit separately for the active `final_five` question through scoped tokens.
- Neither can read the other's answer before reveal.
- Admin sees only `Лиза ответила` / `Виктор ответил` statuses before reveal.

- [ ] **Step 1: Write isolation tests**

DB tests must assert a valid Liza token cannot select Viktor's hidden answer and vice versa.

```tsx
it('shows answer-complete status without exposing the other role value', () => {
  render(<LiveCoupleAnswerPage role="liza" question={q} />);
  expect(screen.queryByText(/ответ виктора/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/quiz/LiveCoupleAnswerPage.test.tsx && supabase test db`
Expected: FAIL.

- [ ] **Step 3: Implement role-scoped submission and status projection**

One row per `(question_id, role)`. Role access can write only its own answer and read only its own submission status until the owner advances reveal state.

- [ ] **Step 4: Implement staged projector reveal**

Order: guest percentages -> Liza answer -> Viktor answer -> verdict. Seed verdict copy: `Совпали. Невероятно.`, `Семейная дискуссия официально открыта.`, `Гости, кажется, знают их лучше.`

- [ ] **Step 5: Run all quiz tests**

Run: `npm run typecheck && npm test -- src/features/quiz src/features/admin/quiz src/features/screen/quiz && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/quiz src/features/screen/quiz supabase
git commit -m "feat: add final-five live couple reveal"
```

---

## Self-Review

- Spec coverage: standard guest voting, optional images, late-voter rules, joint preanswers, irreversible one-time lock, admin completion-only visibility, staged guest/official reveal, separate final five, Liza/Viktor answer isolation and projector presentation are all assigned.
- Placeholder scan: no vague implementation placeholders remain.
- Type consistency: `QuestionType`, reveal phases and official/live answer separation are consistent throughout.
- Security invariant: hidden official/live answers are filtered at database/RPC level before public projection, never merely hidden in React.
