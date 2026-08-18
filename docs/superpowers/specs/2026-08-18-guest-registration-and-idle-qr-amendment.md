# Amendment — Guest registration, idle QR screen, and admin guest list

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Make the event screen useful even when no game or announcement is active. During normal/idle periods, the projector/TV shows a calm branded welcome screen with the public guest QR code. Guests scan it from their phones, register once, receive their virtual Viktor Train ticket/carriage-team assignment, and then use the same guest identity throughout the second-day event on 2026-08-30.

The owner/admin must be able to see and clean up the full guest list from the admin phone UI.

## Idle / standby screen

When no live module, announcement, countdown, tournament focus, or reveal is active, `/screen` defaults to the event standby screen.

The standby screen should include:

- Liza + Viktor event identity
- date: 30.08.2026 (second day)
- short welcome copy
- large persistent public QR code
- short instruction such as `Наведите камеру телефона на QR-код и зарегистрируйтесь`
- optional live count such as `Уже в составе: 27 гостей`
- restrained visual motion only; the QR must remain easy to scan

The QR is not shown on top of an active game or premiere unless the owner explicitly chooses a QR overlay mode later.

## Guest registration form

Required fields:

- `Имя`
- `Фамилия`

Relationship / affiliation field:

Label: `С кем вы сегодня?` or `Откуда вы знаете Лизу и Виктора?`

Recommended options for MVP:

- `Со стороны Лизы`
- `Со стороны Виктора`
- `Общие друзья`
- `Семья / родственники`
- `Коллеги`
- `Другое`

Also support an optional short free-text detail field such as:

- `Подруга Лизы`
- `Коллега Виктора`
- `Сестра жениха`
- `Друг Ильи`

This is better than a generic job-title field because the event mainly needs social context. If a guest wants to include their occupation/position, they can put it in the optional detail field or the owner can later enable a dedicated `Должность` field from admin without changing the core model.

## Registration result

After successful registration:

1. Create the guest identity.
2. Assign one stable carriage/team using the balanced Viktor Train allocation logic.
3. Generate the guest's virtual ticket number.
4. Show the virtual ticket immediately.
5. Persist the guest/device identity so reopening the site returns to the same profile instead of registering again.

## Duplicate prevention

The system should reduce accidental duplicates but not make registration difficult.

Use:

- persistent device/browser identity
- normalized first + last name check within the event as a soft warning, not an automatic hard block

If the same device returns, open the existing guest profile.

If another device submits the same name, allow the submission only after a small warning such as `Гость с таким именем уже зарегистрирован. Это другой человек?` so two legitimate namesakes are still possible.

The owner/admin remains the final cleanup authority.

## Owner/admin guest list

Only the single owner/admin account can access the full registration list.

Admin guest list should show at minimum:

- first name
- last name
- affiliation / relationship category
- optional relationship detail
- carriage/team number and color
- registration time
- Mortal Kombat registration status if applicable
- online/recently-seen status when available

Owner actions:

- search guests
- filter by carriage/team
- filter by affiliation
- open guest details
- edit obvious typo in name/relationship metadata
- manually move guest to another carriage/team
- delete an accidental duplicate registration

Deleting a guest is destructive and requires confirmation.

If the guest has already created dependent event data (votes, tournament participation, etc.), admin deletion must show what will be affected and either cascade safely according to the module rules or require removing/reassigning those dependencies first.

## Data model changes

### `guests`

Fields should include:

- `id`
- `event_id`
- `first_name`
- `last_name`
- `affiliation_type`
- `affiliation_detail` nullable
- `carriage_id`
- `ticket_number`
- `device_key`
- `registered_at`
- `last_seen_at`

Do not require a separate guest user account.

## Screen behavior priority

`/screen` should resolve display priority roughly as follows:

1. Premiere / countdown / active video
2. Explicit owner screen command / major reveal
3. Active game/tournament screen
4. Active carriage announcement if marked for screen
5. Standby welcome + public QR

This ensures the QR automatically returns whenever the event is idle.

## Security

- Public registration can create only guest records through a constrained registration flow/RPC.
- Guests cannot list all registered guests.
- Guests cannot delete or edit other guests.
- Guests cannot directly change their carriage assignment after registration.
- Only the single owner/admin account can list all guests, edit metadata, reassign carriage/team, or delete registrations.
- The public QR contains only the public event join route and no admin credential.

## Testing requirements

- Standby screen shows the public QR whenever no higher-priority screen state is active.
- QR returns automatically after a game/premiere state ends and owner returns screen to standby.
- Required first and last name validation works.
- Affiliation selection persists.
- Same device reopens existing guest instead of creating a new guest.
- Same-name registration on another device produces a warning but can be confirmed for legitimate namesakes.
- Owner can see all registered guests.
- Non-owner clients cannot enumerate the guest list.
- Owner can delete an accidental duplicate with confirmation.
- Deleting a guest with dependent module data is handled safely and visibly.

## Acceptance criteria

1. A guest arriving during an idle period can scan the large on-screen QR without asking the owner for a link.
2. Registration requires first name and last name and captures who the guest is connected to.
3. Successful registration immediately creates the persistent guest profile and virtual Viktor Train ticket.
4. Owner/admin sees the registration appear in realtime on the phone.
5. Owner can clean up accidental duplicate registrations.
6. The QR standby screen automatically remains the default between event activities.
