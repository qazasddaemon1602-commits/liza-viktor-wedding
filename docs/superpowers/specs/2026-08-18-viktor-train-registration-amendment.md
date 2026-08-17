# Amendment — «Поезд Виктора»: регистрация гостей и виртуальный билет

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Use guest registration not only to identify participants in the site, but also to create an event-wide mixing mechanic themed around Viktor's work as a train driver.

Each guest receives a virtual train ticket with a stable carriage assignment. The owner/admin can periodically call specific carriages to activities, helping mix approximately 40 guests throughout the day instead of letting everyone remain in the same social groups.

## Guest registration flow

1. Guest scans the main event QR code.
2. Guest enters display name / nickname.
3. Site creates the guest profile and stable device/session identity.
4. Site assigns a carriage automatically.
5. Guest receives a virtual `ПРОЕЗДНОЙ БИЛЕТ` on screen.
6. Ticket remains available in the guest profile for the rest of the event.
7. Future team selection is associated with the same guest profile, but actual team definitions/options are deferred until later.

The carriage assignment must not be rerolled by refreshing the page or reopening the site.

## Carriage model

Default MVP configuration: 5 carriages for approximately 40 guests, targeting roughly 8 people per carriage.

The allocation should be random-looking but balanced rather than naive random assignment. When a guest registers, choose among the currently least-populated carriages with random tie-breaking. This keeps the groups close in size while preserving the feeling of a random draw.

Owner/admin can configure the number and labels of carriages before the event if needed.

Suggested labels:

- Вагон 1
- Вагон 2
- Вагон 3
- Вагон 4
- Вагон 5

The system should support custom carriage names later without schema changes.

## Virtual ticket

Guest ticket should include at minimum:

- guest display name
- event title / Liza + Viktor
- carriage number/name
- unique visual ticket number (presentation only, not a security credential)
- small QR/barcode-style decorative element
- status / current call if their carriage is being summoned

Visual direction: premium railway ticket with subtle playful references, not a literal Russian Railways clone and not a cartoon train graphic.

The ticket must be designed primarily for phone viewing and should be easy to reopen from the guest hub.

## Carriage calls / announcements

Only the owner/admin can create or clear a carriage call.

Examples:

- `ПАССАЖИРЫ 5 ВАГОНА — ВАШ СОСТАВ ОТПРАВЛЯЕТСЯ НА БАР`
- `ПЕРВЫЙ ВАГОН — НА MORTAL KOMBAT`
- `ВАГОНЫ 2 И 4 — ГОТОВИМСЯ К СЛЕДУЮЩЕМУ КОНКУРСУ`

Owner/admin controls from phone should support:

- choose one carriage
- choose several carriages
- enter/select announcement text
- send call to guest phones
- optionally output the call to `/screen`
- clear the active call

The projector/TV view may show a large railway-style departure announcement when the owner presses `ВЫВЕСТИ НА ЭКРАН`.

Guests belonging to the selected carriage(s) should receive a prominent in-site state on their phone. Browser push notifications are not required for MVP.

## Integration with the celebration hub

The virtual ticket becomes part of the guest's persistent profile, not a separate throwaway page.

Suggested guest hub elements:

- `МОЙ БИЛЕТ`
- current carriage
- current activity / call, if any
- Mortal Kombat registration/status
- current live voting activity
- future team identity once teams are enabled

## Future teams

The data model should include an optional `team_id` on the guest profile from the beginning, but MVP must not hard-code any team names yet.

When team rules are defined later, guests will choose a team from their existing profile without re-registering. Team and carriage are separate concepts:

- `carriage` = randomized mixing group used throughout the event
- `team` = guest-selected competitive/social identity to be defined later

A guest can therefore belong to one carriage and one team simultaneously.

## Admin controls

Owner/admin must be able to:

- see all registered guests
- see carriage membership and counts
- manually move a guest to another carriage if registration data needs correction
- lock carriage assignments before the event starts
- call one or multiple carriages
- send a carriage announcement to the main screen
- clear the current announcement

Manual moves must remain owner-only.

## Data model additions

### `guests`
Add:
- `carriage_id`
- `team_id` nullable
- `ticket_number`
- `registered_at`

### `carriages`
- `id`
- `event_id`
- `label`
- `sort_order`
- `enabled`

### `carriage_calls`
- `id`
- `event_id`
- `message`
- `active`
- `show_on_screen`
- `created_by`
- `created_at`
- `cleared_at`

### `carriage_call_targets`
- `call_id`
- `carriage_id`

This supports calls to one or multiple carriages cleanly.

## Realtime behavior

- Registration assignment persists immediately.
- Guest phones subscribe to active carriage calls targeting their carriage.
- `/screen` subscribes to calls marked `show_on_screen`.
- Owner can trigger/clear calls from phone and all affected clients update in realtime.

## Security

- Guests can create/read only their own registration identity through the public registration flow.
- Guests cannot change `carriage_id` themselves after assignment.
- Guests cannot create/clear carriage calls.
- Only the single owner/admin account can manually reassign guests, manage carriages, or issue announcements.
- `team_id` will follow the future team-selection rules and remains nullable until that module is designed.

## Testing requirements

- 40 sequential registrations remain reasonably balanced across 5 carriages.
- Refresh/reopen does not issue a new carriage to the same guest/device identity.
- Guest cannot mutate their own carriage assignment directly.
- Owner can manually reassign a guest.
- Calls reach only targeted carriage members.
- Multi-carriage calls work.
- Screen announcement appears only when explicitly requested by owner.
- Clearing a call removes it from guest and screen views.

## Acceptance criteria

1. A newly arrived guest can register in seconds and immediately receive a virtual ticket.
2. The ticket contains a stable carriage assignment.
3. About 40 guests distribute across 5 carriages without large imbalance.
4. Owner can call specific carriages from the admin phone UI.
5. Selected guests see the call immediately.
6. Owner can optionally show the same call on the projector.
7. Team support is structurally ready but team definitions and selection UI can be added later.
