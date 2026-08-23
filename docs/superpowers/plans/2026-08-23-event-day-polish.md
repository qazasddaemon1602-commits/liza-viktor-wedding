# Event-Day Continuity and Presentation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved ticket/arrival continuity, Mortal Kombat hard limit of 16, shared quiz reactions, and Liza finale host handoff without adding a new game mechanic.

**Architecture:** Presentation identity and recovery are extracted into small pure helpers/hooks, while `ScreenPage` remains the single owner of projector precedence. Arrival announcements use a privacy-safe reducer, and all MK surfaces share recovery and projector-round derivation. Database changes are forward-only and precede client enforcement.

**Tech Stack:** React 19, TypeScript 7, Vitest/Testing Library, Vite, Supabase PostgreSQL/pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-23-event-day-polish-design.md`

## Global Constraints

- Do not add a game, score, answer, mission, power-up, or progression mechanic.
- Projector order is `Bunker → protected premiere → pinned active/complete MK → FIFO arrival or carriage-call announcement → quiz → completed carriage map → idle registration`; only the winner mounts.
- MK active membership is 2–16; the 17th and later registrants use the existing waitlist.
- Public carriage maps and boarding summaries contain initials only; summary state, DOM, logs, and data attributes contain no guest names.
- Standard arrival/summary reading durations are exactly 14,000/8,000 ms; reduced motion removes movement without reducing reading time.
- MK recovery polls every 5,000 ms and coalesces realtime, visibility, focus, online, mutation, and timer refresh requests.
- Respect global mute and `prefers-reduced-motion`; do not add admin automatic quiz audio.
- Use test-first RED → GREEN → REFACTOR for every behavior change.
- Keep migrations forward-only and local. Do not push, deploy, or apply a remote migration.

---

### Task 1: Projector winner and quiz presentation identity

**Files:**
- Create: `src/features/quiz/quizPresentation.ts`
- Create: `src/features/quiz/quizPresentation.test.ts`
- Modify: `src/features/screen/ScreenPage.tsx`
- Modify: `src/features/screen/ScreenPage.quiz.test.tsx`
- Modify: `src/features/screen/QuizScreenScene.tsx`
- Modify: `src/features/screen/QuizScreenScene.test.tsx`

**Interfaces:**
- Produces: `quizPresentationKey(questionId, phase): string` and `quizAnnouncementKey(questionId, phase, status): string`.
- Produces: winner-only projector rendering and `lastPresentedQuizKeyRef`, retained while quiz is temporarily hidden.
- Consumes: existing `playQuizVotingSignal` and `playQuizRevealSignal` dependencies.

- [ ] **Step 1: Write failing pure identity tests**

```ts
expect(quizPresentationKey('q1', 'voting')).toBe('q1:voting');
expect(quizPresentationKey('q1', 'results')).toBe('q1:results');
expect(quizAnnouncementKey('q1', 'voting', 'accepted')).toBe('q1:voting:accepted');
```

- [ ] **Step 2: Write failing projector visibility tests**

```ts
expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);
expect(screen.queryByTestId('quiz-screen-scene')).not.toBeInTheDocument(); // announcement wins
expect(playQuizRevealSignal).not.toHaveBeenCalled(); // results arrived while hidden
// Finish announcement, render latest results, then expect exactly one reveal signal.
```

Cover repeated visible payload, unchanged hidden-return, hidden closed quiz, and event-slug reset. Verify `Bunker`, premiere, and pinned MK remain higher than announcements.

- [ ] **Step 3: Verify RED**

Run: `npm test -- --run src/features/quiz/quizPresentation.test.ts src/features/screen/ScreenPage.quiz.test.tsx src/features/screen/QuizScreenScene.test.tsx`

Expected: failure because helpers and winner-only/cue-boundary behavior do not exist.

- [ ] **Step 4: Implement the minimal identity and visibility boundary**

```ts
export const quizPresentationKey = (questionId: string, phase: QuizPresentationPhase) =>
  `${questionId}:${phase}`;

export const quizAnnouncementKey = (
  questionId: string,
  phase: QuizPresentationPhase,
  status: QuizAnnouncementStatus,
) => `${questionId}:${phase}:${status}`;
```

Move `activeEvent` into the single projector render branch. Remove scene-owned `onSignal`; play the phase cue in `ScreenPage` only after quiz wins. Reset the last-presented key only when `eventSlug` changes.

- [ ] **Step 5: Verify GREEN and commit**

Run the Step 3 command plus `npm test -- --run src/features/screen/ScreenPage.premiere.test.tsx src/features/screen/ScreenPage.mortal-kombat.test.tsx src/features/screen/ScreenPage.bunker-protection.test.tsx`.

Commit: `feat: enforce projector scene visibility`

---

### Task 2: Ticket timing and authoritative reassignment

**Files:**
- Modify: `src/features/registration/RegistrationPage.tsx`
- Modify: `src/features/registration/RegistrationPage.test.tsx`
- Modify: `src/features/registration/JoinPage.tsx`
- Modify: `src/features/registration/JoinPage.test.tsx`
- Modify: `src/features/admin/AdminPage.tsx`
- Create: `src/features/admin/AdminPage.reassignment-factory.test.ts`
- Modify: `src/features/admin/AdminShell.tsx`
- Modify: `src/features/admin/AdminShell.test.tsx`
- Modify: `src/features/admin/guests/AdminGuestsPage.tsx`
- Modify: `src/features/admin/guests/AdminGuestsPage.test.tsx`

**Interfaces:**
- Produces: `GuestReassignmentCommand { guestId; fromCarriageId; toCarriageId }` and row-scoped pending/status/alert state.
- Produces: phone refresh coordinator with 5,000 ms poll, one in-flight request, one trailing request, focus/online recovery, and last-valid state.
- Consumes: existing `reassignGuestRpc`, carriage refresh broadcast, and guest/carriage loaders.

- [ ] **Step 1: Write failing ticket timing tests**

```ts
window.matchMedia = reducedMotionMatchMedia(true);
await registerSuccessfully();
expect(screen.getByTestId('virtual-ticket')).toBeInTheDocument();
expect(screen.queryByText('ФОРМИРУЕМ МАРШРУТ…')).not.toBeInTheDocument();
```

Also prove standard motion waits 900 ms and unmount clears its timer.

- [ ] **Step 2: Write failing phone convergence tests**

Use fake timers and deferred promises to prove poll at 5,000 ms, focus/online/realtime convergence through one coordinator, one trailing load during overlap, last-valid ticket after error, and no late commit after unmount.

- [ ] **Step 3: Write failing per-row reassignment tests**

```ts
expect(within(rowA).getByRole('combobox')).toBeDisabled();
expect(within(rowB).getByRole('combobox')).toBeEnabled();
expect(await within(rowA).findByRole('status')).toHaveTextContent('назначен ВАГОН №4');
expect(await within(rowA).findByRole('alert')).toHaveTextContent('Остаётся ВАГОН №3');
```

Use deferred refreshes to prove responses started before the command cannot overwrite that guest; after settlement a new authoritative reload wins. Prove best-effort broadcast failure does not reverse a successful RPC.

- [ ] **Step 4: Verify RED**

Run: `npm test -- --run src/features/registration/RegistrationPage.test.tsx src/features/registration/JoinPage.test.tsx src/features/admin/guests/AdminGuestsPage.test.tsx src/features/admin/AdminShell.test.tsx src/features/admin/AdminPage.reassignment-factory.test.ts`

- [ ] **Step 5: Implement minimal coordinators and row feedback**

```ts
type GuestReassignmentCommand = {
  guestId: string;
  fromCarriageId: string;
  toCarriageId: string;
};
```

Skip the route state entirely for reduced motion. Track phone and per-guest generations; ignore older responses. Broadcast refresh to old and new carriage channels only after RPC success and swallow only broadcast failure.

- [ ] **Step 6: Verify GREEN and commit**

Run Step 4 plus `npm test -- --run src/features/registration/GuestJoinPage.test.tsx src/features/admin/admin.service.test.ts`.

Commit: `feat: harden ticket and reassignment continuity`

---

### Task 3: Bounded arrival FIFO and compact boarding summary

**Files:**
- Create: `src/features/screen/arrivalAnnouncementQueue.ts`
- Create: `src/features/screen/arrivalAnnouncementQueue.test.ts`
- Create: `src/features/screen/BoardingSummaryScene.tsx`
- Create: `src/features/screen/BoardingSummaryScene.test.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`
- Modify: `src/features/screen/ScreenPage.test.tsx`
- Modify: `src/features/screen/ScreenPage.registration-map.test.tsx`
- Modify: `src/features/screen/TrainArrivalScene.tsx`
- Modify: `src/features/screen/TrainArrivalScene.test.tsx`
- Modify: `src/features/screen/CarriageMapScreen.tsx`
- Modify: `src/features/screen/CarriageMapScreen.test.tsx`
- Modify: `src/styles/wedding-editorial.css`
- Modify: `src/styles/wedding-scenes.css`

**Interfaces:**
- Produces: `announcementQueueReducer`, `createAnnouncementQueueState`, `BoardingSummaryPresentation`, and `CarriageMapScreen` variant `summary`.
- Consumes: Task 1 winner-only projector branch and existing screen event IDs/map loader.

- [ ] **Step 1: Write failing reducer matrix tests**

```ts
expect(receiveArrival(free, a1).active?.presentation.kind).toBe('arrival');
expect(receiveManyDuringActive([a2, a3]).pending[0].kind).toBe('boarding_summary');
expect(JSON.stringify(receiveManyDuringActive([a2, a3]))).not.toContain('displayName');
```

Cover ID dedupe, single pending arrival, carriage call permanently closing a batch, one trailing batch, protection cancellation/drop/seen behavior, and session reset.

- [ ] **Step 2: Verify reducer RED, then implement it**

Run: `npm test -- --run src/features/screen/arrivalAnnouncementQueue.test.ts`

Implement the discriminated unions from the spec. An arrival that joins a batch contributes only its event ID and carriage ID.

- [ ] **Step 3: Write failing summary and privacy tests**

```tsx
expect(screen.getByText('СОСТАВ ПОПОЛНЕН · +4')).toBeInTheDocument();
expect(screen.getByRole('status')).toHaveTextContent('Состав пополнен: 4 пассажира');
expect(container.textContent).not.toContain('Иван Петров');
expect(screen.queryByTestId('carriage-map-host')).not.toBeInTheDocument();
```

Prove totals come from the latest map, all active carriages/initials render, and no ornamental full header/portrait appears.

- [ ] **Step 4: Implement summary UI and integrate durations/protection**

```ts
type BoardingSummarySceneProps = {
  summary: BoardingSummaryPresentation;
  map: RegistrationCarriageMap | null;
};
```

Use exactly 14,000 ms for arrival and 8,000 ms for summary. On protected entry cancel presentation/audio and mark IDs seen; while protected only invalidate the map; on exit request one map refresh without catch-up.

- [ ] **Step 5: Update passenger copy and verify GREEN**

Replace visual and accessible `ПРИБЫЛ НОВЫЙ ИГРОК` with `ПРИБЫЛ НОВЫЙ ПАССАЖИР`. Run:

`npm test -- --run src/features/screen/arrivalAnnouncementQueue.test.ts src/features/screen/BoardingSummaryScene.test.tsx src/features/screen/CarriageMapScreen.test.tsx src/features/screen/TrainArrivalScene.test.tsx src/features/screen/ScreenPage.test.tsx src/features/screen/ScreenPage.registration-map.test.tsx src/features/screen/ScreenPage.premiere.test.tsx src/features/screen/ScreenPage.mortal-kombat.test.tsx src/features/screen/ScreenPage.bunker-protection.test.tsx`

- [ ] **Step 6: Commit**

Commit: `feat: coalesce projector boarding arrivals`

---

### Task 4: Mortal Kombat hard maximum of 16

**Files:**
- Create: `supabase/migrations/20260823045000_mortal_kombat_max_16.sql`
- Create: `supabase/tests/mortal_kombat_max_16.sql`
- Delete: `supabase/tests/mortal_kombat_40_players.sql`
- Modify: `supabase/tests/mortal_kombat_admin.sql`
- Modify: `supabase/tests/release_function_privilege_hardening.sql`
- Modify: `src/features/mortalKombat/mk.types.ts`
- Modify: `src/features/mortalKombat/bracket.ts`
- Modify: `src/features/mortalKombat/bracket.test.ts`
- Modify: `src/features/mortalKombat/mk.service.ts`
- Modify: `src/features/mortalKombat/mk.service.test.ts`
- Modify: `src/features/mortalKombat/mk.owner.service.ts`
- Modify: `src/features/mortalKombat/mk.owner.service.test.ts`
- Modify: `src/features/mortalKombat/MkSignupCard.tsx`
- Modify: `src/features/mortalKombat/MortalKombatPage.tsx`
- Modify: `src/features/mortalKombat/MortalKombatPage.test.tsx`
- Modify: `src/features/mortalKombat/mkMilestones.ts`
- Modify: `src/features/mortalKombat/mkMilestones.test.ts`

**Interfaces:**
- Produces: database and TypeScript `MK_MAX_PLAYERS = 16`, rounds `r16/qf/sf/final`, stable waitlist repair, and precondition `MK_MAX_16_REQUIRES_RESET`.
- Consumes: historical migrations unchanged; existing waitlist/promote/reset RPC identities.

- [ ] **Step 1: Write failing pgTAP max-16 tests**

Test default/check 16, 17th/18th waitlist, full-pool promotion refusal, draw rejection for 17 active, reset to 16, stable `(registered_at,id)` overflow, seed clearing, row preservation, and exact reset precondition for active/complete oversize or R64/R32 data.

- [ ] **Step 2: Verify SQL RED**

Run: `npx supabase test db supabase/tests/mortal_kombat_max_16.sql supabase/tests/mortal_kombat_admin.sql supabase/tests/release_function_privilege_hardening.sql`

Expected: new migration/contracts are absent or still 40.

- [ ] **Step 3: Implement the forward-only migration**

```sql
create or replace function public._repair_mk_max_16_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp;

revoke all on function public._repair_mk_max_16_data() from public, anon, authenticated;
```

Lock tournament rows, repair only `registration`/`draw_ready`, abort unsafe `active`/`complete`, then redefine defaults/checks and MK open/reset/promote/draw/seed functions for 16. Delete no rows.

- [ ] **Step 4: Write failing TypeScript contract/copy tests**

```ts
expect(() => buildBracket(seededPlayers(16))).not.toThrow();
expect(() => buildBracket(seededPlayers(17))).toThrow(/16/);
expect(screen.getByText('ОСНОВНАЯ СЕТКА ЗАПОЛНЕНА · 16 ИЗ 16. ВЫ В ЛИСТЕ ОЖИДАНИЯ · №1.')).toBeInTheDocument();
```

- [ ] **Step 5: Implement client max-16 contract and verify GREEN**

Set `MK_MAX_PLAYERS = 16`, remove R64/R32 client branches, preserve 2/3/9/16 bye behavior, and update only MK copy/tests.

Run: `npm test -- --run src/features/mortalKombat/bracket.test.ts src/features/mortalKombat/mk.service.test.ts src/features/mortalKombat/mk.owner.service.test.ts src/features/mortalKombat/MortalKombatPage.test.tsx src/features/mortalKombat/mkMilestones.test.ts`.

- [ ] **Step 6: Commit**

Commit: `feat: cap mortal kombat bracket at 16`

---

### Task 5: Shared MK recovery and accessible admin commands

**Files:**
- Create: `src/features/mortalKombat/useMkRecovery.ts`
- Create: `src/features/mortalKombat/useMkRecovery.test.tsx`
- Modify: `src/features/mortalKombat/MkScreenPage.tsx`
- Create: `src/features/mortalKombat/MkScreenPage.recovery.test.tsx`
- Modify: `src/features/admin/mortalKombat/AdminMkControl.tsx`
- Create: `src/features/admin/mortalKombat/AdminMkControl.recovery.test.tsx`
- Modify: `src/features/admin/mortalKombat/MatchEditor.tsx`
- Modify: `src/features/admin/mortalKombat/MatchEditor.test.tsx`
- Create: `src/features/admin/mortalKombat/useMkDialogFocus.ts`
- Create: `src/features/admin/mortalKombat/useMkDialogFocus.test.tsx`
- Modify: `src/features/admin/mortalKombat/CorrectionImpactDialog.tsx`
- Modify: `src/features/admin/mortalKombat/CorrectionImpactDialog.test.tsx`
- Create: `src/features/admin/mortalKombat/MkResetDialog.tsx`
- Create: `src/features/admin/mortalKombat/MkResetDialog.test.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`
- Create: `src/features/screen/ScreenPage.mortal-kombat-recovery.test.tsx`
- Modify: `src/styles/mortal-kombat.css`

**Interfaces:**
- Produces: `useMkRecovery<T>({ scopeKey, load, subscribe, pollIntervalMs })` returning `{ state, stale, requestRefresh, invalidate }`.
- Produces: reusable dialog focus containment and reset dialog with fresh input per open.

- [ ] **Step 1: Write failing recovery hook tests**

Prove initial load, 5,000 ms poll, common realtime/focus/online/visible request path, one trailing request, generation rejection, last-valid stale state, recovery clearing stale, scope reset, and cleanup.

- [ ] **Step 2: Verify RED, implement hook, verify GREEN**

Run: `npm test -- --run src/features/mortalKombat/useMkRecovery.test.tsx`.

```ts
export function useMkRecovery<T>(options: MkRecoveryOptions<T>): MkRecoveryResult<T>;
```

Increment generation on scope change and `invalidate`; an overlapping request sets one trailing flag.

- [ ] **Step 3: Write failing surface integration tests**

Prove missed realtime updates converge on admin/shared/dedicated screens, owner mutation invalidates an old response, and errors keep the last valid bracket with a stale indicator.

- [ ] **Step 4: Write failing command/dialog accessibility tests**

Prove rejected fight selection clears busy, preserves bracket, and renders `<p role="alert">`. Prove Cancel initial focus, Tab containment, non-busy Escape, focus return, and empty reset input on reopen.

- [ ] **Step 5: Integrate hook/dialogs and contrast tokens**

Use the same hook on all three surfaces. Route fight selection through the caught `MatchEditor` mutation path. Extract reset UI. Fix dark foreground/background token pairs without changing the MK art direction.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --run src/features/mortalKombat/useMkRecovery.test.tsx src/features/admin/mortalKombat/AdminMkControl.recovery.test.tsx src/features/mortalKombat/MkScreenPage.recovery.test.tsx src/features/screen/ScreenPage.mortal-kombat-recovery.test.tsx src/features/admin/mortalKombat/MatchEditor.test.tsx src/features/admin/mortalKombat/CorrectionImpactDialog.test.tsx src/features/admin/mortalKombat/MkResetDialog.test.tsx`.

Commit: `fix: harden mortal kombat live control`

---

### Task 6: Deterministic MK projector round and champion gong

**Files:**
- Create: `src/features/mortalKombat/mkPresentation.ts`
- Create: `src/features/mortalKombat/mkPresentation.test.ts`
- Create: `src/features/mortalKombat/useMkChampionGong.ts`
- Create: `src/features/mortalKombat/useMkChampionGong.test.tsx`
- Modify: `src/features/mortalKombat/PublicBracket.tsx`
- Modify: `src/features/mortalKombat/PublicBracket.test.tsx`
- Modify: `src/features/mortalKombat/ChampionScene.tsx`
- Modify: `src/features/mortalKombat/MkScreenPage.tsx`
- Modify: `src/features/mortalKombat/MkScreenPage.test.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`
- Modify: `src/features/screen/ScreenPage.mortal-kombat.test.tsx`
- Modify: `src/features/screen/screenAudio.ts`
- Modify: `src/features/screen/screenAudio.test.ts`
- Modify: `src/styles/mk-artbook.css`

**Interfaces:**
- Produces: `findCurrentReadyMkBout`, `deriveMkProjectorRound`, `countCompletedRealMkBouts`, and `useMkChampionGong`.
- Consumes: Task 5 shared recovery state and `topVisible` projector ownership.

- [ ] **Step 1: Write failing pure projector derivation tests**

```ts
expect(deriveMkProjectorRound(r16AndReadyQf)).toBe('r16');
expect(findCurrentReadyMkBout(completedCurrent)).toBeNull();
expect(countCompletedRealMkBouts(completed16PlayerBracket)).toBe(15);
```

Also assert completed real counts 1/2/8/15 for 2/3/9/16 players.

- [ ] **Step 2: Write failing component/layout tests**

Prove projector navigation is absent, only the derived round mounts, byes are omitted, all eight R16 cards mount, shared/dedicated routes agree, long Cyrillic names wrap to at most two lines, and champion copy uses computed bouts.

- [ ] **Step 3: Write failing gong tests**

```ts
expect(playTournamentGong).toHaveBeenCalledTimes(1);
rerender(<Harness state={sameChampionPayload} topVisible />);
expect(playTournamentGong).toHaveBeenCalledTimes(1);
expect(sessionStorage.getItem(`mk:gong:${tournamentId}:${championGuestId}`)).toBe('1');
```

Cover hidden-under-protection, remount, polling, muted/unarmed behavior, and first top-visible complete transition.

- [ ] **Step 4: Implement derivation, grid, count, and gong boundary**

Choose real ready current, else earliest real ready, else deepest completed real, else earliest real bout. Render a 4×2 opening grid. Write the session key before audio invocation. Add `screenAudio.playTournamentGong()` using `tournament.gong` with major priority; remove champion-owned impact/success cue.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/mortalKombat/mkPresentation.test.ts src/features/mortalKombat/PublicBracket.test.tsx src/features/mortalKombat/useMkChampionGong.test.tsx src/features/mortalKombat/MkScreenPage.test.tsx src/features/screen/ScreenPage.mortal-kombat.test.tsx src/features/screen/screenAudio.test.ts`.

Commit: `feat: focus mortal kombat projector presentation`

---

### Task 7: Shared quiz reactions on phone, projector, and admin

**Files:**
- Modify: `src/features/quiz/GuestLiveQuizCard.tsx`
- Modify: `src/features/quiz/GuestLiveQuizCard.test.tsx`
- Modify: `src/features/screen/QuizScreenScene.tsx`
- Modify: `src/features/screen/QuizScreenScene.test.tsx`
- Modify: `src/features/admin/quiz/AdminQuizLiveControl.tsx`
- Create: `src/features/admin/quiz/AdminQuizLiveControl.test.tsx`
- Modify: `src/features/admin/quiz/AdminQuizPanel.tsx`
- Modify: `src/features/admin/quiz/AdminQuizPanel.test.tsx`
- Modify: `src/styles/quiz.css`
- Create: `src/styles/quiz-reactions.scope.test.ts`

**Interfaces:**
- Consumes: Task 1 `quizPresentationKey` and `quizAnnouncementKey`.
- Produces: visible/open/submitting/accepted/locked/error/results statuses and dedicated live regions; `SceneTransition` is the only quiz entrance wrapper.

- [ ] **Step 1: Write failing phone status/audio/a11y tests**

Prove visible copy for open, `ЛИЗА/ВИКТОР · ФИКСИРУЕМ ОТВЕТ…`, accepted/locked, results, and error. Announcement identity is `questionId:phase:status`; answered-count/repeated payload does not replay audio or announcement, and passive refresh does not move focus.

- [ ] **Step 2: Write failing projector/admin tests**

Prove projector answered-count stays outside the live region and bespoke curtain is absent. Prove only admin live card is inside `SceneTransition`, history/lists remain outside, phase changes announce, answered count does not, and no admin automatic audio occurs.

- [ ] **Step 3: Verify RED**

Run: `npm test -- --run src/features/quiz/GuestLiveQuizCard.test.tsx src/features/screen/QuizScreenScene.test.tsx src/features/admin/quiz/AdminQuizLiveControl.test.tsx src/features/admin/quiz/AdminQuizPanel.test.tsx src/styles/quiz-reactions.scope.test.ts`.

- [ ] **Step 4: Implement shared reaction semantics**

Use a dedicated `role="status"`/`role="alert"` node keyed by presentation status. Remove `.quiz-screen-transition-curtain`, `quiz-paper-reveal`, `quiz-results-arrive`, and their reduced-motion duplicates; retain static paper/archive styling. Do not add admin audio.

- [ ] **Step 5: Verify and commit**

Run Step 3 plus `npm test -- --run src/features/quiz/GuestQuizPage.test.tsx src/features/guest/GuestHub.test.tsx src/features/screen/SceneTransition.test.tsx src/lib/siteAudio.test.ts`.

Commit: `feat: unify quiz reactions across surfaces`

---

### Task 8: Liza reveal host handoff

**Files:**
- Modify: `src/features/admin/bunker/BunkerHostRunbook.tsx`
- Modify: `src/features/admin/bunker/BunkerHostRunbook.test.tsx`
- Modify: `src/features/admin/runbook/eventHostContent.ts`
- Modify: `src/features/admin/runbook/EventHostRunbook.test.tsx`

**Interfaces:**
- Produces: exact pre-reveal cue, silence/lighting action, and exact post-reveal line for `BUNKER_OPEN`.
- Consumes: existing `INTERMISSIONS.BUNKER_OPEN`, reveal screen, and `FINISHED` epilogue without changing their mechanics.

- [ ] **Step 1: Write failing scoped runbook tests**

```ts
expect(nowRead).toHaveTextContent('Последний сигнал принят. Пожалуйста, смотрите на экран.');
expect(nowRead).not.toHaveTextContent('Лиза');
expect(afterCompletion).toHaveTextContent('Источник BK-17 раскрыт. Лиза ждала именно этот состав. Маршрут Виктора завершён.');
```

Prove dim light occurs before cue, host waits for door/reveal/full screen line, warm light/applause occurs after, and `FINISHED` remains separate.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/features/admin/bunker/BunkerHostRunbook.test.tsx src/features/admin/runbook/EventHostRunbook.test.tsx`.

- [ ] **Step 3: Update only host copy/actions**

Do not touch Bunker state, RPC, reveal audio, screen guard, mission content, or SQL. Align `bunker-final.next` so it requires the full reveal before warm light.

- [ ] **Step 4: Verify and commit**

Run Step 2 plus `npm test -- --run src/features/bunker/BunkerScreenGuard.final-tv.test.tsx src/features/bunker/operator/LizaRevealScreen.test.tsx`.

Commit: `feat: stage liza reveal host handoff`

---

### Task 9: Audio cleanup and full event rehearsal

**Files:**
- Modify: `src/lib/audioManifest.ts`
- Modify: `src/lib/audioManifest.test.ts`
- Modify: `src/features/screen/screenAudio.ts`
- Modify: `src/features/screen/screenAudio.test.ts`
- Modify: `scripts/generate-audio-assets.mjs`
- Modify: `public/audio/ATTRIBUTION.md`
- Delete: `public/audio/arrival/chime.wav`
- Modify: `src/styles/train-arrival.css`
- Modify: `e2e/event-flow.spec.ts`
- Create: `e2e/mortal-kombat-responsive.spec.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: no dead arrival cue, current E2E selectors, burst/reassignment rehearsal, and MK viewport coverage.

- [ ] **Step 1: Write failing cleanup and E2E contracts**

Assert the manifest has no `arrival.chime`, arrival uses only `arrival.sequence`, and E2E locates `arrival-convoy`. Add Playwright cases for six-arrival burst, privacy-safe summary, reassignment during refresh, reduced motion, and 1366×768/1920×1080 no-scroll maps.

Add MK E2E for 18 joins → 16 active + waitlist positions 1/2, eight visible opening bouts on both projector routes, long Cyrillic names, and 320×700/390×844 no horizontal overflow.

- [ ] **Step 2: Verify focused RED**

Run: `npm test -- --run src/lib/audioManifest.test.ts src/features/screen/screenAudio.test.ts`.

- [ ] **Step 3: Remove dead audio/legacy selectors and update E2E**

Delete only proven-unused arrival selectors and the dead cue/generator/attribution/file. Preserve `.train-arrival`, `__wash`, `__atmosphere`, `__convoy`, `__sprite`, `__smoke`, and `__wagon-copy`.

- [ ] **Step 4: Run focused regressions**

Run:

```powershell
npm test -- --run src/features/screen/ScreenPage.test.tsx src/features/screen/ScreenPage.quiz.test.tsx src/features/screen/ScreenPage.registration-map.test.tsx src/features/screen/ScreenPage.mortal-kombat.test.tsx src/features/mortalKombat/MkScreenPage.test.tsx src/features/quiz/GuestLiveQuizCard.test.tsx src/features/admin/bunker/BunkerHostRunbook.test.tsx
rg -n "arrival\.chime|chime\.wav|arrival-train-plate|ПРИБЫЛ НОВЫЙ ИГРОК|\/ 40|40 МЕСТ" src public scripts e2e
```

Only historical design documentation may retain removed-contract wording.

- [ ] **Step 5: Run complete local gate**

```powershell
npm test
npm run typecheck
npm run build
git diff --check
```

Run local pgTAP and browser suites only when their required Supabase/E2E environment is available; otherwise record the exact unavailable prerequisite without applying remote changes.

- [ ] **Step 6: Commit**

Commit: `test: rehearse event-day presentation`
