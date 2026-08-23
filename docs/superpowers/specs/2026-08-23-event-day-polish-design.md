# Event-Day Continuity and Presentation Polish

## Goal

Strengthen the existing wedding-event mechanics without adding a new game or changing established rules. The work joins four already implemented areas into one coherent event-day experience:

1. ticket issuance, boarding, train arrival and carriage-map continuity;
2. Mortal Kombat reliability and presentation with a hard maximum bracket of 16;
3. one shared transition language and consistent quiz reactions;
4. the existing Bunker finale with an explicit host handoff to Liza's reveal.

The result should feel faster, clearer and more cinematic on phones, the admin console and the projector while remaining recoverable under weak network conditions.

## Global constraints

- No new game, score, answer, mission, power-up or progression mechanic.
- Existing registration, ticket, carriage, quiz and MK database identities remain authoritative.
- Projector precedence is explicit and deterministic: `Bunker → protected premiere → pinned active/complete MK → FIFO arrival or carriage-call announcement → quiz → completed carriage map → idle registration`.
- Only the winning projector scene is mounted. Hidden scenes may refresh data, but cannot animate, announce or play sound.
- All new polling is bounded, coalesced and cleaned up on unmount; realtime remains a refresh signal rather than the only source of truth.
- Global mute and `prefers-reduced-motion` are respected.
- Phone actions remain at least 52 px and all state changes have text equivalents.
- No full names are added to the public carriage map or boarding summary. Existing arrival-name behavior is not expanded to new surfaces.
- Migrations are forward-only. No production migration, push or deploy occurs without separate authorization.

## Package A — Ticket, boarding and arrival continuity

### Current journey retained

The existing flow remains authoritative:

`registration → server carriage assignment → phone ticket reveal → persistent guest hub ticket → projector arrival → carriage map`

Ticket design, carriage colors/marks, the recorded 14-second arrival sequence and the live carriage map remain unchanged in meaning.

### Phone ticket timing

- Standard motion keeps the current short route transition before revealing the ticket.
- Reduced motion never mounts or announces the route screen: the ticket appears immediately after successful registration without the fixed 900 ms delay.
- Ticket details remain visible in the guest hub after the initial ceremony.
- A carriage reassignment refreshes the ticket through the existing refresh channel plus a five-second recovery poll and focus/online recovery. Loads are one-flight and preserve the last valid ticket.

### Projector arrival backlog

The first arrival when the projector is free retains the full existing 14-second train ceremony and its existing train audio. This ceremony is the only arrival sound contract; the dead `arrival.chime` cue and attribution are removed.
Its public heading is standardized as `ПРИБЫЛ НОВЫЙ ПАССАЖИР` rather than game-oriented `ПРИБЫЛ НОВЫЙ ИГРОК`.

Arrival and carriage-call events use one bounded event-session FIFO with stable event IDs:

- an already-seen event ID is ignored;
- when the projector is free, the first arrival receives the full ceremony;
- consecutive registrations received while an announcement is active form one pending registration batch;
- a carriage call permanently closes the open registration batch and keeps its original FIFO position; later arrivals start a new batch after that call even if the earlier batch has not mounted;
- a pending batch of one receives the full ceremony; a batch of two or more becomes one eight-second summary;
- arrivals merge only into the open registration batch at the FIFO tail; this creates at most one trailing batch behind the currently visible announcement;
- while a protected Bunker, premiere or pinned MK scene is active, newly received arrival/call IDs are immediately marked seen, never queued, and only invalidate the carriage map;
- entering protection cancels visible/pending announcements, stops their audio and marks their IDs seen; exiting protection performs one authoritative map refresh with no catch-up presentation.

The summary shows `СОСТАВ ПОПОЛНЕН · +N` and an accessible live message such as `Состав пополнен: 4 пассажира. Сейчас в вагоне №2 — 3 пассажира…`. It stores only deduplicated event IDs, a count and carriage IDs: no guest name is rendered, logged, placed in data attributes or retained in presentation state. Distribution is calculated at render time from the latest aggregate public carriage-map model so a reassignment cannot leave contradictory totals.

The summary includes a summary-specific compact map with every active carriage and its seated initials. It omits the Ilya portrait and the ornamental full-map header, and must fit both projector targets without scrolling. Standard and reduced-motion modes keep the same 14-second/8-second reading time; reduced motion reveals all information immediately and removes movement only.

This is a presentation-only aggregation. Every guest remains registered and seated individually in the existing data model.

### Admin reassignment feedback

The existing carriage selector gains explicit per-guest states:

- pending: only that guest's row is disabled with `ПЕРЕСАЖИВАЕМ…`;
- success: a polite status such as `Иван Петров: назначен ВАГОН №4.` confirms the accepted command without claiming every remote screen has already converged;
- failure: an inline alert such as `Не удалось пересадить. Остаётся ВАГОН №3. ПОВТОРИТЬ.` restores the latest authoritative carriage and offers retry;
- each guest row owns a generation token: refresh responses started before its reassignment command cannot commit for that guest; after the command settles, a new authoritative reload is started and that newer generation wins.

No new reassignment endpoint is added.

### Cleanup

- Replace the stale E2E expectation for the removed `arrival-train-plate` with the current convoy contract.
- Remove CSS/selectors that are provably unused by current components after test coverage confirms no consumer.
- Remove the unreachable `arrival.chime` cue and attribution; do not introduce a second arrival sound.

## Package B — Mortal Kombat, maximum 16

### Authoritative limit

- The active tournament pool and bracket support 2–16 players only.
- The 17th and later registrants enter the existing waitlist.
- Server RPC validation, public state, admin copy, client constants and tests all use 16 as the single maximum.
- Bracket creation rejects more than 16 active players and continues to use byes for non-power-of-two counts.
- Redraw never changes membership or promotes waitlisted players implicitly.
- Existing waitlist promotion/removal tools remain unchanged.

### Migration safety

- A forward-only migration atomically locks affected tournament rows. An absent tournament row is the existing `idle` state and requires no repair.
- For `registration` or `draw_ready`, active registrations are ranked by `(registered_at, id)`: the first 16 remain active and overflow moves to the existing waitlist. Existing and new waitlisted rows keep stable `(registered_at, id)` order, and all pre-start active/waitlisted seed values become `NULL` before a later draw.
- If an `active` or `complete` tournament has more than 16 active registrations or contains an R64/R32 bracket, the migration aborts with `MK_MAX_16_REQUIRES_RESET`; publication then waits for an explicit MK reset.
- Only after those checks does the migration set database defaults/checks and the open/reset, promotion, draw and seed contracts to 16. No guest or registration row is deleted.

### Admin readiness

- Fix the dark-theme contrast so all labels, secondary copy and controls meet readable contrast.
- Admin MK, shared `/screen` MK and dedicated `/mortal-kombat/screen` poll every five seconds while mounted. Realtime, visibility becoming visible, focus and online events request the same refresh.
- Each surface uses one coordinator: at most one request is in flight and any overlap becomes one trailing refresh. A tournament/event dependency change or owner mutation increments a generation; older responses cannot commit. A successful owner mutation invalidates and schedules the trailing reload. Failures preserve the last valid state and show stale status until the next success. The cadence is injected in tests, and timers/listeners are removed on unmount.
- New phone joins and waitlist promotions appear without a page reload.
- Fight selection uses the existing `MatchEditor` mutation/error path: rejection is caught, busy state is cleared, the last bracket remains visible and a `<p role="alert">` reports the error.
- Correction/reset dialogs put initial focus on the safe Cancel action, reset confirmation input on every open, contain Tab focus, allow Escape only while not busy, and return focus to the opener.

### Projector and bracket

- The dedicated MK projector receives the recovery contract and stale-state indicator defined above.
- Both projector routes derive the displayed round identically: use the authoritative current match only when it is a real `ready` bout; otherwise choose the earliest round containing a real `ready` bout. If no real bout is ready, use the deepest round containing a completed real bout, then fall back to the earliest round containing any real bout. Projector-local round switching is not exposed, and no new database identity or tournament mechanic is added.
- Every real two-player bout in that derived round is visible; bye placeholders are omitted.
- At 16 players, all eight opening-round cards fit simultaneously at 1366×768 and 1920×1080 without scrolling, including long two-line Cyrillic names.
- Champion copy derives the completed two-player bout count from the authoritative bracket instead of fixed `LAST BOUT · 15`; at completion it equals `activeCount - 1` and is tested for 2, 3, 9 and 16 players.
- The gong plays at the first top-visible transition to `complete` with a champion, once per `tournamentId:championGuestId` per browser session. On shared and dedicated projectors, injected `playTournamentGong` uses the projector audio controller and its mute/volume state, replaces the old impact/success cue at that boundary, and does not replay after polls, remounts or repeated payloads. Muted or unarmed audio fails silently. No new audio file is introduced.

### Mobile

- The already implemented transient-load recovery remains.
- Join, active, waitlist, waiting, bracket and champion states are tested at 320–390 px.
- The active limit is visibly `16`; the 17th player sees `ОСНОВНАЯ СЕТКА ЗАПОЛНЕНА · 16 ИЗ 16. ВЫ В ЛИСТЕ ОЖИДАНИЯ · №N.`

## Package C — Shared transitions and quiz reactions

### One visual language

- `SceneTransition` becomes the sole phase-transition wrapper for phone quiz, projector quiz and the admin's current live-question card. Admin lists, history, busy controls, couple reveal and Final Five remain outside it.
- The bespoke projector paper curtain/results entry is removed where it duplicates the shared transition.
- Existing quiz paper/archive art direction remains in static styling; only duplicated entrance choreography is normalized.
- Transition keys are derived from authoritative question ID and phase, not ordinary rerenders.

### Projector visibility boundary

- Quiz phase cues and transitions fire only when quiz wins the global projector precedence and becomes top-visible.
- The projector tracks the last visibly presented `questionId:phase`. Hidden quiz updates collapse to the latest authoritative value. On return, it performs exactly one entry/cue only when that key differs; an unchanged or closed quiz performs none.
- Repeated payloads for the same visible key never replay the transition, sound or announcement.

### Audio

- Phone quiz keeps the existing `siteAudio` voting/results/error cues and global mute behavior.
- Projector quiz continues through its existing screen audio controller, but cue ownership moves to the visible-scene boundary.
- Admin receives the shared visual transition and live-region text but no new automatic audio, because the admin surface has no dedicated visible mute control.
- Reduced motion removes wipes/slides while retaining immediate text and status changes.

### Accessibility

- Selected, submitting, accepted/locked, error and results states use visible text and a dedicated live region rather than color alone. Announcements are keyed by `questionId:phase:status`; answered-count refreshes and repeated payloads do not announce again.
- Focus is not moved on passive phase refreshes.
- Replayed realtime payloads do not replay sound or announcements.

## Package D — Bunker reveal handoff for the host

The already implemented Liza reveal remains mechanically unchanged, but the host runbook is aligned with the scene:

- before `BUNKER_OPEN`, the host still does not name Liza or confirm the source;
- when the server enters `BUNKER_OPEN`, the host says: `Последний сигнал принят. Пожалуйста, смотрите на экран.` and stops speaking;
- the host waits for the existing door → reveal audio and the complete on-screen line `Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза`;
- only after the reveal, the host says: `Источник BK-17 раскрыт. Лиза ждала именно этот состав. Маршрут Виктора завершён.`;
- the runbook action is explicit: dim the room before the cue, do not talk over Liza, then bring up warm light and lead applause;
- the existing `FINISHED` results/epilogue handoff remains after this emotional beat.

## Architecture and sequencing

The four workstreams belong to one release checkpoint but are implemented as isolated reviewed tasks:

1. shared transition/visibility contract;
2. quiz adoption of that contract;
3. ticket/arrival queue and reassignment continuity;
4. MK limit-16 server contract;
5. MK admin/projector/visual polish;
6. Bunker host reveal-script alignment;
7. combined viewport and event-day regression.

Implementation commits are serialized because `ScreenPage`, shared audio and global styles overlap. Read-only investigation and independent reviews may run in parallel through subagents.

## Error and recovery rules

- A failed refresh never clears the last valid ticket, map, quiz or tournament state.
- Manual admin command failures are visible and never masquerade as success.
- Realtime loss converges through bounded polling and focus/online recovery.
- Old async responses from a previous event/session cannot overwrite the current one.
- Timers, subscriptions, audio cues and pending queues are cleaned up on session change and unmount.

## Verification

### Automated

- Unit tests for ordered queue batching/interruption, privacy-safe summary state, reduced-motion ticket/arrival timing and per-row reassignment states.
- Integration tests for phone → projector → admin continuity and stale-response protection.
- SQL/pgTAP for MK maximum 16, stable overflow waitlisting, bracket rejection and reset behavior.
- MK admin/shared/dedicated projector five-second recovery, generation protection and dialog accessibility tests.
- Quiz visibility-race, cue deduplication, mute and reduced-motion tests.
- Full Vitest, typecheck and production build.

### Viewports

- Phones: 320×700 and 390×844.
- Projector: 1366×768 and 1920×1080.
- Verify no horizontal overflow; projector scenes must not require scrolling.

### Event rehearsal

- burst of at least six registrations during one arrival;
- carriage reassignment while phone/projector refreshes are in flight;
- 16 MK active players plus at least two waitlisted players;
- redraw, reset, failed fight selection, realtime disconnect/reconnect;
- quiz phase change underneath an arrival overlay, then unchanged and changed return-to-visibility cases;
- muted and reduced-motion modes on each relevant surface.

## Acceptance criteria

- A registration burst cannot hold the projector in a minute-long arrival backlog.
- Protected-scene interruption cannot replay or leak cancelled arrival data; the map refreshes to the authoritative final seating.
- Ticket, reassignment, arrival and map converge without a manual page reload.
- MK never creates or displays a bracket larger than 16; overflow uses the existing waitlist.
- Admin, shared projector and dedicated projector recover from missed realtime updates.
- The deterministically derived MK round fits both projector resolutions; all eight real opening bouts fit simultaneously for 16 players.
- Quiz transitions and sounds occur once, only when the quiz is visible.
- The host does not reveal or talk over Liza before the `BUNKER_OPEN` screen completes.
- No existing game mechanics, scores, answers or Bunker precedence change.
- All changes remain local until explicit publication authorization.
