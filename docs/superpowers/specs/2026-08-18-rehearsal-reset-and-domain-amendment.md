# Amendment — Rehearsal reset and temporary production domain

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Allow the owner to rehearse the event repeatedly before 30 August 2026 using fake/test guests, test votes, tournament entries, screen events and connected displays, then return the live event to a clean pre-arrival state without losing prepared content or the couple's locked quiz answers.

The production event should also use an inexpensive custom domain rather than depending only on a `*.lovable.app` URL.

## Rehearsal reset

Admin must include a dedicated owner-only action:

`СБРОСИТЬ РЕПЕТИЦИЮ`

This is not a generic database wipe. It resets runtime/event-session data while preserving prepared event configuration.

### Data cleared by rehearsal reset

Clear/reset:

- all registered guest records used for the rehearsal;
- guest device/session bindings and recovery codes;
- generated guest ticket numbers;
- carriage assignments that belong to those guest records;
- guest quiz votes;
- live final-five Liza/Viktor answers submitted during rehearsal;
- carriage calls and carriage-call targets;
- queued/shown test screen events;
- Mortal Kombat registrations, waiting list, bracket, matches, results and tournament history;
- runtime premiere state such as armed/countdown/playing flags and `premiere_start_at`;
- current active module/question/match state;
- temporary owner action log entries from the rehearsal, except for one final reset audit entry;
- transient projector presence/preflight state where appropriate;
- screen mode returns to the normal idle QR state.

### Data preserved by rehearsal reset

Preserve:

- event identity and dates: wedding 2026-08-29, second day 2026-08-30;
- owner/admin account and security configuration;
- question bank, ordering, enabled state and question images/media;
- locked joint Liza + Viktor pre-answers for normal quiz questions;
- the consumed/locked state protecting those pre-answers from later edits;
- carriage definitions, labels, colors and visual marks;
- wedding visual palette and copy/settings;
- premiere media configuration/file reference;
- expected guest count and non-runtime event configuration;
- production domain/deployment configuration;
- paired screen names/configuration may remain unless owner explicitly chooses a separate `ОТВЯЗАТЬ ЭКРАНЫ` action.

The rehearsal reset must never unlock, delete or replace the locked joint couple pre-answer set.

## Confirmation UX

Because this is destructive, the owner must see a pre-reset summary, for example:

`Будет удалено:`
- `18 гостей`
- `143 тестовых голоса`
- `12 участников Mortal Kombat`
- `7 результатов боёв`
- `24 события экрана`

`Будет сохранено:`
- `вопросы и изображения`
- `зафиксированные ответы Лизы и Виктора`
- `вагоны и цвета`
- `видео премьеры`
- `настройки сайта`

Require explicit confirmation text:

`СБРОСИТЬ РЕПЕТИЦИЮ`

Then execute one protected server/database transaction. Partial reset is not acceptable.

After success show:

`РЕПЕТИЦИЯ СБРОШЕНА`
`Система готова к новой проверке.`

## Security

- Only the single authenticated event owner may call the rehearsal-reset RPC.
- Guest, Liza, Viktor and screen clients cannot call it.
- The operation must run server/database-side, not as a sequence of browser deletes.
- The reset RPC must explicitly exclude locked couple pre-answer tables/rows.
- Record a final owner-only audit entry containing reset timestamp and deleted-row counts.

## Testing requirements

1. Reset removes all rehearsal guests and their device bindings.
2. Reset removes guest votes and live final-five answers.
3. Reset removes/reset Mortal Kombat runtime state.
4. Reset clears calls and screen-event queue and returns screen to idle.
5. Locked joint couple pre-answers remain byte-for-byte unchanged and still locked.
6. Question records/images remain unchanged.
7. Carriage definitions/colors remain unchanged.
8. Non-owner reset attempts fail.
9. A failed transaction leaves the event unchanged rather than half-reset.
10. After reset, a previously used rehearsal phone can register as a new guest again.

## Temporary production domain

Use a custom domain for the event rather than publishing the guest QR only to `*.lovable.app`.

A one-year registration is sufficient; no long-term renewal is required after the event unless the owner wants to keep the project online.

Prefer a short Latin `.ru` name for Russian guests and easy manual entry below the QR. The final name depends on availability, examples only:

- `liza-vitya.ru`
- `liza-viktor.ru`
- `lv30.ru`
- another short available `.ru` chosen before deployment.

The join URL displayed under the QR should use the production custom domain, for example `https://lv30.ru` or `https://lv30.ru/go`.

Domain registration and hosting are separate concerns: the domain may be bought cheaply from a registrar and pointed to the chosen production hosting/CDN.

## Acceptance criteria

1. Owner can rehearse repeatedly and restore the event to a clean guest/runtime state with one protected action.
2. Prepared questions and locked couple answers survive every rehearsal reset.
3. The production QR uses a custom domain rather than requiring guests to depend on a `lovable.app` address.
