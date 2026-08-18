# Amendment — Late arrivals, open registration, and premiere quorum

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Keep the second-day event inclusive for guests who arrive late while preserving the intended timing of the wedding-track premiere as an early major collective moment.

The premiere should happen once the main body of guests has arrived and registered, but it must not wait indefinitely for every expected guest. Registration remains open throughout the evening so late arrivals can still receive a Viktor Train ticket, join a carriage/team, and participate in all still-available activities.

## Registration remains open

- Public guest registration remains available throughout the event unless the owner explicitly disables it.
- The idle/standby screen continues to show the public QR whenever no higher-priority event screen is active.
- Late arrivals register through the same flow as everyone else: first name, last name, affiliation, optional detail.
- They receive the same persistent guest profile, virtual ticket, carriage/team assignment, arrival animation, and admin notification.
- A late guest is not treated as a separate class of user.

## Carriage assignment after activities have begun

Existing guests must never be silently moved just because a late guest arrives.

For a late registration:

1. keep all existing carriage assignments fixed;
2. assign the new guest to the least-populated suitable carriage using the same balancing logic;
3. when possible, also preserve a healthy mix of Liza-side / Viktor-side / family / common-friend affiliations;
4. owner may manually reassign the new guest if needed.

`ЗАФИКСИРОВАТЬ СОСТАВ` therefore means existing assignments are frozen, not that registration is closed. New passengers may still be appended to the train without reshuffling earlier guests.

## Premiere timing

Do not require exactly 40/40 or every expected guest to be registered before the premiere.

The owner remains the only person who can start the premiere manually.

Admin should show a soft readiness indicator based on:

- configurable expected guest count, initially around 40;
- current registered count;
- current/recent registration activity;
- projector/video/audio preflight readiness.

Suggested display:

- `Зарегистрировано: 31 / ~40`
- `Последний гость: 7 мин назад`
- `Основной состав собран`
- `Премьера готова`

The site may recommend that the main group appears assembled, but it must never auto-start the premiere.

A useful default heuristic for the recommendation is:

- a substantial majority of expected guests are registered (for example 75–85% or an owner-configurable threshold), and
- there have been no new registrations for several minutes,
- and premiere preflight is green.

This is guidance only. Ilya decides the real-world moment.

## After the premiere

- Registration immediately continues as normal.
- The idle QR returns when the screen goes back to standby.
- Late guests still receive their arrival train animation and carriage assignment unless another high-priority screen is active.
- The premiere does not automatically replay for late arrivals.
- The owner may manually replay the video later if desired, but that is a deliberate admin action, not automatic behavior.

## Late participation in live modules

### Quiz / voting

A guest who registers after the quiz has already started may participate immediately.

Rules:

- if the current question is still open and not revealed, the late guest may vote on it;
- if the current question has already been revealed/closed, they join from the next question;
- they can answer all subsequent questions normally;
- their late arrival must not reset or invalidate previous vote totals.

### Couple pre-answer quiz

The locked pre-answers of Liza and Viktor are independent from guest arrival time. Late guests simply vote on any still-open questions and see the same reveal as everyone else.

### Viktor Train / carriage activities

Late arrivals immediately become members of their assigned carriage/team and receive all future carriage calls and team-based activities.

### Mortal Kombat

- if tournament registration is still open and fewer than 16 confirmed players exist, a late guest may join from their registered guest profile;
- if the bracket has already been finalized/started, the late guest does not get inserted automatically into an in-progress bracket;
- they may join a waitlist or be added manually only if the owner intentionally edits the bracket.

### Premiere

Late guests arriving after the premiere simply join the ongoing event normally. Missing the premiere does not block any other site functionality.

## Main-screen behavior

The public QR is the default fallback between activities, including after the premiere.

Screen priority remains:

1. premiere/countdown/video
2. explicit owner-pinned screen / major reveal
3. active game or tournament presentation
4. high-priority event announcement
5. idle welcome + QR + live event status

Registration arrival animations are queued and shown only when they do not interrupt higher-priority content.

## Admin controls

Owner/admin should have:

- expected guest count setting;
- live registered count;
- recent-arrival timestamp/activity;
- `Основной состав собран` readiness indicator;
- manual `ПОДГОТОВИТЬ ПРЕМЬЕРУ` and `НАЧАТЬ ПРЕМЬЕРУ` controls;
- registration open/closed toggle;
- separate `ЗАФИКСИРОВАТЬ СОСТАВ` action that freezes current carriage assignments without closing late registration.

## Testing requirements

- registering after the premiere still creates a normal guest profile and ticket;
- frozen existing carriage assignments do not move when new guests register;
- late guests can vote on an open current question but cannot retroactively vote on closed/revealed questions;
- late guests receive future carriage calls;
- late Mortal Kombat signup respects bracket registration state;
- premiere readiness is advisory only and cannot auto-start playback;
- QR standby returns after premiere and remains usable for late arrivals.

## Acceptance criteria

1. The premiere can happen with the main body of guests present without waiting for every late arrival.
2. Ilya manually decides when to launch it.
3. Registration remains available afterward.
4. Late guests receive a normal carriage/team and remain fully included in subsequent activities.
5. Existing teams and past results are never disrupted by a late registration.
