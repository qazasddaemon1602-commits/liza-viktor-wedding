# Guest Hub + Timed Live Quiz Design

Date: 2026-08-19
Status: approved in chat, awaiting written-spec review
Scope: package 1 only — guest hub, live quiz 30/30 flow, admin controls/history

## Goal

Turn the guest phone experience into one persistent event dashboard instead of a set of disconnected pages. After a guest receives a ticket, `/join` becomes their personal hub. Live Quiz should appear automatically on the guest phone, run on server-authoritative 30-second phases, and return the guest to the hub when the round ends. The owner must be able to close phases early, move to the next question, return the shared screen to the main event screen, and review completed questions from the admin dashboard.

## Existing foundation we keep

- Guest identity stays device-bound through the existing device key and ticket restore flow. No guest email/password accounts are added.
- `/join` remains the canonical guest route.
- Existing ticket, carriage assignment, carriage-call notification, quiz questions, votes, owner quiz controls, TV quiz scene, Realtime refresh channels, and projector priority rules remain in place.
- Existing `/play` quiz route remains available for compatibility, but the primary guest experience moves into `/join` as an embedded live activity.
- No Mortal Kombat or Bunker quest redesign is included in this package. Those integrate into the hub in later packages.

## Guest Hub

When `JoinPage` restores or registers a guest, it renders a new `GuestHub` composition instead of leaving the user on a ticket-only screen.

The hub contains:

1. `My Ticket` — existing virtual ticket with guest name, carriage, ticket number and wedding date.
2. `Now` — one high-priority live activity card. For package 1 this supports Live Quiz and carriage calls. Later packages can add MK and Bunker without changing the hub contract.
3. `My Activities` — lightweight status cards. In package 1 this shows quiz participation/last answer state; existing MK link can remain as a secondary action until package 2.
4. `Evening History` — compact recent event entries. For package 1 this includes completed quiz rounds the guest participated in or observed.

The hub itself does not navigate away when a quiz starts. A live quiz card expands prominently in the `Now` area and receives keyboard/focus priority. When the round closes it collapses back into the hub automatically.

## Live Quiz phase model

The current `idle / voting / results` model remains conceptually intact, but timing becomes authoritative and persisted.

Each activation creates a persisted quiz round with these logical fields:

- round id
- event id
- question id
- phase: `voting | results | closed`
- voting started at
- voting ends at
- results started at
- results ends at
- closed at

`quiz_state` continues to point at the current active question/round for compatibility with existing screen selection. Completed round rows become the source for admin and guest history.

Default timings:

- Voting: 30 seconds
- Results: 30 seconds

The server stores phase end timestamps. Clients never start an independent new 30-second timer. They render `phaseEndsAt - now`, so a phone joining 12 seconds late sees 18 seconds remaining.

## Automatic transitions

The system must not depend on a single browser tab staying healthy.

State-read RPCs normalize expired rounds transactionally:

- expired `voting` becomes `results`, freezes further votes, records result-phase timestamps and returns aggregate results;
- expired `results` becomes `closed`, clears the active quiz state and records `closed_at`.

Admin and guest clients also schedule a local refresh at the known phase deadline for immediate UI response. Realtime remains the fast notification path, while authoritative timestamps/RPC normalization are the correctness path.

This means a dropped Realtime message may delay a refresh by a small amount but cannot create a different timer or allow late votes.

## Guest quiz experience

When a question opens, the guest hub automatically promotes the Live Quiz card.

Voting phase:

- shows the question, optional image, answer options and a large countdown;
- allows one answer per existing guest/device rule;
- after submission, selected answer is visibly locked and `ОТВЕТ ПРИНЯТ` is shown;
- at zero, buttons become unavailable even before the refresh response arrives.

Results phase:

- automatically replaces voting controls with percentages;
- keeps the guest's selected option visibly marked;
- shows a second 30-second countdown;
- no vote changes are allowed.

Closed phase:

- live card collapses;
- a compact history entry remains in the hub;
- the guest does not need to navigate back manually.

If Realtime is unavailable, the page refreshes state on tab focus and at the known phase deadline. Existing connectivity errors remain non-destructive: the ticket stays visible and the hub keeps the last known state.

## Admin Live Quiz controls

The admin dashboard gets one focused `Live Quiz` control block.

During `voting`:

- countdown to vote close;
- answered count;
- `ЗАКРЫТЬ ОТВЕТЫ СЕЙЧАС` — immediately transitions to `results` and starts a fresh 30-second results window;
- `ВЕРНУТЬ ОСНОВНОЙ ЭКРАН` — removes Quiz from the shared TV presentation without deleting or resetting the active round.

During `results`:

- countdown to result close;
- live percentages;
- `ЗАКРЫТЬ ВОПРОС` — immediately closes the round and clears the active quiz state;
- `СЛЕДУЮЩИЙ ВОПРОС` — closes the current round if needed and activates the next enabled question with a new 30-second voting window;
- `ВЕРНУТЬ ОСНОВНОЙ ЭКРАН` remains available.

During `idle`:

- owner can activate any enabled unanswered question;
- completed questions are visually separated from remaining questions.

No separate hidden `results-ready` phase is introduced. Closing answers means results are visible immediately; this keeps the event flow simple and matches the approved 30 seconds voting + 30 seconds percentages model.

## Admin history

Below the active controls, the admin dashboard shows a compact completed-round history ordered newest first.

Each row shows:

- question text;
- completed time;
- total answers;
- Liza percentage/count;
- Viktor percentage/count;
- result summary appropriate to the question type where already supported by existing quiz/couple-answer logic.

History is read-only in package 1. Editing/deleting historical rounds is intentionally out of scope.

## Shared TV behavior

The TV uses the same server phase timestamps as guests and admin.

- `voting`: question + countdown + answered count.
- `results`: percentages + countdown.
- `closed/idle`: Quiz no longer owns the screen unless the owner deliberately activates another question.
- `ВЕРНУТЬ ОСНОВНОЙ ЭКРАН` changes presentation routing only; it does not destroy the current round or guest answers.

Existing projector priority remains unchanged: Bunker > Premiere > explicitly shared MK > Quiz > carriage arrival/call > idle registration.

## Data and RPC changes

Add one migration for the timed-round model and owner/guest history reads. Prefer extending existing quiz functions rather than creating parallel state machines.

Expected backend responsibilities:

- create/activate quiz round with 30-second voting deadline;
- reject votes after `voting_ends_at` even if a stale client still shows buttons;
- transition current round to results manually or when expired;
- close current round manually or when results expire;
- return `phaseStartedAt`, `phaseEndsAt` and current round id in guest, owner and screen projections;
- return completed round summaries for admin history;
- return a small recent-history projection for the guest hub;
- preserve existing vote uniqueness and guest-device authorization.

## Frontend boundaries

New components/hooks should be small and reusable:

- `GuestHub` — layout and section composition only.
- `GuestLiveActivity` — selects the highest-priority guest activity.
- `GuestLiveQuizCard` — voting/results presentation embedded inside the hub.
- `useGuestQuizLiveState` — load, Realtime subscription and deadline refresh scheduling.
- `QuizPhaseTimer` — presentation-only countdown from a server timestamp.
- `AdminQuizLiveControl` — current round controls/timer.
- `AdminQuizHistory` — read-only completed-round list.

Existing `GuestQuizPage` should reuse the same quiz-card/state logic so `/play` does not become a second implementation.

## Styling

Guest hub stays in the approved wedding-editorial / railway visual system. Live Quiz can be more energetic but remains part of that world: cream/ivory paper, graphite/forest typography, ticket-line details and restrained motion. It should not adopt Mortal Kombat or Bunker styling.

The live card must be designed primarily for a 390px-wide phone and remain usable with one hand.

## Error handling

- Ticket restore failure keeps the existing retry screen.
- Quiz load failure never hides the guest's ticket/hub; it shows a compact connectivity notice in the `Now` area.
- Vote submission failure restores the answer controls if the voting deadline has not passed.
- If the deadline passes during a failed submission, the UI locks and refreshes authoritative state.
- Realtime failure is non-fatal because timestamps and explicit state reads remain authoritative.

## Testing strategy — faster event-development mode

To avoid hour-long waits after tiny edits:

During implementation tasks:

- run only the directly affected unit/component/service tests;
- run TypeScript typecheck after each coherent code slice;
- do not run full Playwright after every button or CSS change.

Before the package is merged:

- one full unit suite;
- one production build;
- one database/migration validation pass;
- one full Playwright E2E run covering registration -> hub -> quiz voting -> automatic/manual results -> close -> history and existing critical event flows.

Full E2E remains a merge gate, not a per-edit gate.

## Acceptance criteria

1. A registered guest can stay on `/join` all evening and see their ticket plus live activity area.
2. Opening a quiz question causes it to appear in the open guest hub without navigation or manual refresh.
3. Voting starts with a server-authoritative 30-second deadline.
4. A late-opening client sees only the remaining time.
5. Votes are rejected after the server deadline.
6. At voting expiry, percentages become available for a 30-second results phase.
7. Owner can close voting early, close results early, start the next question and return the TV to the main screen.
8. Closing/returning the TV does not delete answers or round history.
9. Completed rounds appear in a compact admin history list.
10. The guest hub returns to its normal state automatically after quiz close and retains a compact history entry.
11. Existing ticket restore, carriage calls, projector priority and standalone `/play` compatibility continue to work.
12. Full E2E runs only once as the final package merge gate.

## Explicitly out of scope for this package

- system-level Web Push / PWA background notifications;
- Mortal Kombat hub integration beyond retaining the existing link;
- Bunker character cards, hidden attributes, team tasks, scoring or final code;
- editing/deleting completed quiz history;
- changing guest identity from device-bound tickets to email/password accounts.

