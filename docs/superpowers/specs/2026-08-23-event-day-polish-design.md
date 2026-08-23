# Event-Day Continuity and Presentation Polish

## Goal

Strengthen the existing wedding-event mechanics without adding a new game or changing established rules. The work joins three already implemented areas into one coherent event-day experience:

1. ticket issuance, boarding, train arrival and carriage-map continuity;
2. Mortal Kombat reliability and presentation with a hard maximum bracket of 16;
3. one shared transition language and consistent quiz reactions.

The result should feel faster, clearer and more cinematic on phones, the admin console and the projector while remaining recoverable under weak network conditions.

## Global constraints

- No new game, score, answer, mission, power-up or progression mechanic.
- Existing registration, ticket, carriage, quiz and MK database identities remain authoritative.
- Projector precedence remains: protected Bunker/premiere/MK scenes override quiz and registration overlays.
- All new polling is bounded, coalesced and cleaned up on unmount; realtime remains a refresh signal rather than the only source of truth.
- Global mute and `prefers-reduced-motion` are respected.
- Phone actions remain at least 52 px and all state changes have text equivalents.
- No full names are added to the public carriage map. Existing arrival-name behavior is not expanded to new surfaces.
- Migrations are forward-only. No production migration, push or deploy occurs without separate authorization.

## Package A — Ticket, boarding and arrival continuity

### Current journey retained

The existing flow remains authoritative:

`registration → server carriage assignment → phone ticket reveal → persistent guest hub ticket → projector arrival → carriage map`

Ticket design, carriage colors/marks, the recorded 14-second arrival sequence and the live carriage map remain unchanged in meaning.

### Phone ticket timing

- Standard motion keeps the current short route transition before revealing the ticket.
- Reduced motion skips the fixed 900 ms wait and reveals the ticket on the next render tick; it does not replace motion with dead time.
- Ticket details remain visible in the guest hub after the initial ceremony.
- A carriage reassignment refreshes the ticket through the existing refresh channel plus a five-second recovery poll and focus/online recovery. Loads are one-flight and preserve the last valid ticket.

### Projector arrival backlog

The first arrival when the projector is free retains the full existing 14-second train ceremony.

While a ceremony is active, subsequent arrivals are accumulated for that event session:

- one pending arrival receives the same full ceremony next;
- two or more pending arrivals become one eight-second boarding summary rather than N serial 14-second scenes;
- the summary shows `СОСТАВ ПОПОЛНЕН · +N`, a carriage distribution such as `ВАГОН №2 × 3`, and the updated full carriage map;
- it does not show a new list of guest names;
- a later burst is coalesced into at most one queued summary, so the queue is bounded;
- protected scenes pause presentation and resume from authoritative current data without replaying completed arrivals.

This is a presentation-only aggregation. Every guest remains registered and seated individually in the existing data model.

### Admin reassignment feedback

The existing carriage selector gains explicit states:

- pending: control disabled with `ПЕРЕСАЖИВАЕМ…`;
- success: text confirmation with the new carriage;
- failure: actionable inline error and the previous selection restored;
- external changes converge through refresh/polling without overwriting an in-progress local command.

No new reassignment endpoint is added.

### Cleanup

- Replace the stale E2E expectation for the removed `arrival-train-plate` with the current convoy contract.
- Remove CSS/selectors that are provably unused by current components after test coverage confirms no consumer.
- Keep `arrival.chime` only if it becomes reachable through an existing scene cue; otherwise remove the dead manifest entry rather than introducing a second arrival sound.

## Package B — Mortal Kombat, maximum 16

### Authoritative limit

- The active tournament pool and bracket support 2–16 players only.
- The 17th and later registrants enter the existing waitlist.
- Server RPC validation, public state, admin copy, client constants and tests all use 16 as the single maximum.
- Bracket creation rejects more than 16 active players and continues to use byes for non-power-of-two counts.
- Redraw never changes membership or promotes waitlisted players implicitly.
- Existing waitlist promotion/removal tools remain unchanged.

### Migration safety

- A forward-only migration clamps future registration/reset configuration to 16.
- For a tournament still in `idle` or `registration`, if more than 16 active registrations exist, the earliest 16 by authoritative join order remain active and overflow moves to the existing waitlist in stable order.
- A tournament with an already created/running bracket above 16 is not silently rewritten. The migration raises a clear precondition error and publication must wait for an explicit MK reset.
- No guest record is deleted.

### Admin readiness

- Fix the dark-theme contrast so all labels, secondary copy and controls meet readable contrast.
- Admin state refreshes on MK realtime signals, a bounded recovery poll, focus and online events; one-flight/coalescing prevents overlap.
- New phone joins and waitlist promotions appear without a page reload.
- Fight selection uses the existing shared error boundary and reports rejection inline.
- Correction/reset dialogs receive initial focus, focus containment, Escape handling and focus return.

### Projector and bracket

- The dedicated MK projector receives the same polling, focus/online recovery and stale-state indicator as the shared projector.
- The public bracket is explicitly fitted and tested for 2–16 players at 1366×768 and 1920×1080.
- A full 16-player opening round must remain fully readable without hidden overflow; density may compact, but no match is omitted.
- Champion copy derives the total match count from the authoritative bracket instead of fixed `LAST BOUT · 15`.
- The existing tournament gong is wired through the existing audio preference/controller and plays only at the approved milestone/champion boundary. No new audio file is introduced.

### Mobile

- The already implemented transient-load recovery remains.
- Join, active, waitlist, waiting, bracket and champion states are tested at 320–390 px.
- The active limit is visibly `16`; waitlist copy clearly explains that the main bracket is full.

## Package C — Shared transitions and quiz reactions

### One visual language

- `SceneTransition` becomes the sole phase-transition wrapper for phone quiz, projector quiz and admin quiz state changes.
- The bespoke projector paper curtain/results entry is removed where it duplicates the shared transition.
- Existing quiz paper/archive art direction remains in static styling; only duplicated entrance choreography is normalized.
- Transition keys are derived from authoritative question ID and phase, not ordinary rerenders.

### Projector visibility boundary

- Quiz phase cues and transitions fire only when quiz is the top visible projector scene.
- If an arrival or carriage-call overlay is active, a quiz update may refresh data but does not animate or play beneath it.
- When the overlay ends, the projector mounts the latest authoritative quiz phase and performs exactly one transition/cue.
- Bunker, premiere and MK precedence remains unchanged.

### Audio

- Phone quiz keeps the existing `siteAudio` voting/results/error cues and global mute behavior.
- Projector quiz continues through its existing screen audio controller, but cue ownership moves to the visible-scene boundary.
- Admin receives the shared visual transition and live-region text but no new automatic audio, because the admin surface has no dedicated visible mute control.
- Reduced motion removes wipes/slides while retaining immediate text and status changes.

### Accessibility

- Correct/incorrect/locked/result states use visible text and live-region announcements rather than color alone.
- Focus is not moved on passive phase refreshes.
- Replayed realtime payloads do not replay sound or announcements.

## Architecture and sequencing

The three packages belong to one release checkpoint but are implemented as isolated reviewed tasks:

1. shared transition/visibility contract;
2. quiz adoption of that contract;
3. ticket/arrival queue and reassignment continuity;
4. MK limit-16 server contract;
5. MK admin/projector/visual polish;
6. combined viewport and event-day regression.

Implementation commits are serialized because `ScreenPage`, shared audio and global styles overlap. Read-only investigation and independent reviews may run in parallel through subagents.

## Error and recovery rules

- A failed refresh never clears the last valid ticket, map, quiz or tournament state.
- Manual admin command failures are visible and never masquerade as success.
- Realtime loss converges through bounded polling and focus/online recovery.
- Old async responses from a previous event/session cannot overwrite the current one.
- Timers, subscriptions, audio cues and pending queues are cleaned up on session change and unmount.

## Verification

### Automated

- Unit tests for queue coalescing, reduced-motion ticket timing and reassignment states.
- Integration tests for phone → projector → admin continuity and stale-response protection.
- SQL/pgTAP for MK maximum 16, stable overflow waitlisting, bracket rejection and reset behavior.
- MK admin/dedicated projector recovery and dialog accessibility tests.
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
- quiz phase change underneath an arrival overlay;
- muted and reduced-motion modes on each relevant surface.

## Acceptance criteria

- A registration burst cannot hold the projector in a minute-long arrival backlog.
- Ticket, reassignment, arrival and map converge without a manual page reload.
- MK never creates or displays a bracket larger than 16; overflow uses the existing waitlist.
- Admin and dedicated projector recover from missed realtime updates.
- A full 16-player bracket fits both projector resolutions.
- Quiz transitions and sounds occur once, only when the quiz is visible.
- No existing game mechanics, scores, answers or Bunker precedence change.
- All changes remain local until explicit publication authorization.
