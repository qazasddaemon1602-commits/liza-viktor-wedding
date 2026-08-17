# Amendment — Operational safeguards, recovery, smart mixing, and admin resilience

Date: 2026-08-18
Status: Approved concept amendment

This amendment captures the remaining operational recommendations that were discussed and approved after the earlier registration, train, screen-control, and tournament amendments. It must be included in the implementation plan together with all prior amendments.

## 1. Smarter carriage/team allocation by affiliation

Carriage assignment must be balanced not only by total headcount but also, where practical, by guest affiliation.

Goal: avoid accidentally putting most of Viktor's friends in one carriage and most of Liza's friends in another.

The allocator should prefer placements that keep each carriage reasonably mixed across categories such as:

- side of Liza
- side of Viktor
- family/relatives
- common friends
- colleagues
- other

This remains a soft balancing objective, not a rigid quota. Total carriage size remains the first constraint, followed by reasonable affiliation diversity.

Owner may manually override assignments at any time before/after lock where operationally necessary.

## 2. QR fallback short URL

The idle QR screen must include a short human-readable fallback URL beneath the QR code.

If the camera does not recognize the QR, a guest can type the short URL manually and reach the same public registration route.

The final production domain/path can be chosen during deployment; implementation should support a configurable short join URL.

## 3. Guest profile recovery

Normal return behavior:

- same browser/device reopens the existing guest profile automatically;
- ticket, carriage/team, MK registration, and activity state are preserved.

Owner-assisted recovery must also exist for lost/new devices.

From admin, owner can choose an existing guest and issue a new recovery/join link or short-lived recovery code that binds the new device/session to the existing guest record rather than creating a duplicate.

Recovery must not expose the full guest list or allow arbitrary guest impersonation.

## 4. Lock the carriage/team composition

Admin includes a clear action such as `ЗАФИКСИРОВАТЬ СОСТАВ`.

Before lock:

- registrations are assigned automatically using balanced allocation;
- owner may freely correct assignments.

After lock:

- existing guest carriage/team assignments remain stable;
- public users cannot reroll or change them;
- owner can still make an explicit manual override if needed;
- newly arriving late guests are placed by a controlled late-registration rule: fill available capacity or require owner placement when the composition is already operationally fixed.

Lock state must be visible in admin.

## 5. Never rely on color alone

Carriage/team identity is always represented by at least two signals:

- carriage number/name
- assigned carriage color

Color is a secondary navigation aid, never the sole identifier. This applies to tickets, admin, announcements, scoreboard, projector, MK/team references, and guest profile.

## 6. Mortal Kombat registration uses existing guest identities

Mortal Kombat participation must attach to already registered event guests.

Guest flow:

- guest opens their existing profile;
- presses `УЧАСТВОВАТЬ В MORTAL KOMBAT` while registration is open;
- no second name entry is required.

Owner sees the participant's real guest identity and carriage/team.

Maximum active bracket size: 16.

If 16 slots are occupied, implementation should support a simple waiting-list state rather than silently failing. Owner can promote/remove participants manually before bracket lock.

## 7. Always-visible emergency/admin controls

The admin phone UI must have an always-easy-to-reach emergency screen-control area with at least:

- `ГЛАВНЫЙ QR`
- `ЧЁРНЫЙ ЭКРАН`
- `ОСТАНОВИТЬ ТЕКУЩИЙ РЕЖИМ`
- `ВЕРНУТЬ ГЛАВНЫЙ ЭКРАН`

These controls should not require drilling through module-specific menus.

Destructive or state-reset actions require confirmation where appropriate, but `ЧЁРНЫЙ ЭКРАН` should remain fast.

Only the single owner/admin account can trigger them.

## 8. Network/offline resilience

The event must degrade gracefully during temporary network problems.

Required behavior:

- projector keeps rendering its last valid screen state rather than replacing it with a browser error;
- core UI shell, fonts/icons, question illustrations where practical, and other essential visual assets should be cacheable/preloaded;
- premiere media should be preflighted and buffered/cached as far as practical before public playback;
- realtime clients automatically reconnect/resubscribe after network restoration;
- owner and projector show a small degraded/reconnecting status instead of losing the whole interface;
- server-authoritative actions must not be falsely shown as completed if persistence failed.

The architecture may use a PWA/service-worker cache or equivalent asset caching strategy if appropriate during implementation planning.

Full offline voting without a backend is not required for MVP; resilience is about keeping the presentation and UI usable and recovering cleanly.

## 9. Admin technical-status strip

Admin must show a compact status area, visible without opening settings, including as available:

- `Экран: подключён / нет связи`
- `Realtime/Интернет: онлайн / переподключение`
- `Видео: готово / не готово`
- `Звук: разрешён / требуется действие`
- `Гостей онлайн/недавно активных: N`

Premiere retains its stricter preflight requirements and must not start countdown unless required states are ready.

## 10. Owner action history / event log

Store a lightweight owner-visible activity log for important operational actions, for example:

- guest registered/deleted/reassigned
- carriage call sent/cleared
- question activated/revealed
- screen mode changed
- MK registration closed
- tournament result recorded/undone
- premiere armed/started/cancelled

Admin should show at least the latest 10–20 meaningful entries with time and action summary.

This log is for operational recovery and audit, not public display.

## 11. Guest privacy on public views

The full guest registration dataset is owner-only.

Public/projector views should display the minimum necessary identity.

Examples:

- registration animation: `ИВАН П. → ВАГОН №3` rather than full private profile data;
- MK public bracket may use display name chosen/derived for the event;
- affiliation detail, full surname, registration metadata, and owner notes must not be exposed unless explicitly intended for that module.

## 12. Ticket issuance transition

After successful registration, do not jump abruptly from form to ticket.

Use a short branded transition such as:

- `РЕГИСТРАЦИЯ ЗАВЕРШЕНА`
- `Формируем маршрут…`
- reveal/slide in the virtual ticket

Target duration should remain quick and celebratory, approximately 1–2 seconds before the ticket is fully usable.

This is separate from the public-screen train arrival animation, which may run for approximately 3–4 seconds.

## 13. Idle-screen live composition summary

During idle mode, the public screen may periodically show non-private aggregate composition data while keeping the QR available, for example:

`В СОСТАВЕ УЖЕ 34 ПАССАЖИРА`

and carriage counts:

- `Вагон 1 · 7`
- `Вагон 2 · 7`
- `Вагон 3 · 6`
- `Вагон 4 · 7`
- `Вагон 5 · 7`

Do not show the full guest list or affiliations on the public screen.

## Data/model implications

Implementation planning should account for fields/entities equivalent to:

- event/carriage composition lock state
- guest recovery credential/session binding mechanism
- guest affiliation fields already defined in registration amendment
- MK participant linked by `guest_id`
- admin action log
- client connection/preflight presence/status as needed

Avoid duplicating guest identity across modules.

## Testing requirements

At minimum verify:

1. Balanced allocation considers both capacity and affiliation diversity.
2. Same device restores existing guest profile.
3. Owner-assisted recovery binds a new device to the existing guest instead of duplicating.
4. Composition lock prevents public reroll/change.
5. Late registration after lock follows controlled placement rules.
6. Carriage UI always shows number/name as well as color.
7. MK participant links to an existing guest record and respects 16-player capacity/waiting-list behavior.
8. Guest/Liza/Viktor cannot trigger emergency admin actions.
9. Projector survives a short realtime/network interruption with last valid display state and reconnects.
10. Admin status indicators reflect connected/disconnected/preflight states.
11. Action log records key owner mutations and is owner-only.
12. Public views do not expose full guest metadata.
13. Ticket issuance transition does not create a second guest record on refresh/reentry.

## Acceptance criteria

All recommendations from the approved operational review are considered part of the product specification and must be reflected in the implementation plan. In any conflict, this amendment supplements the later approved owner/admin, registration, carriage/team, screen-event, and tournament amendments and preserves their stricter security/access rules.
