# Owner-only admin and screen-control amendment

Date: 2026-08-18
Status: Approved amendment
Supersedes conflicting wording in the main wedding celebration hub design around `host`, admin access, and projector control.

## 1. One administrator only

There is exactly one administrative identity for the event: the owner's Supabase Auth account (Ilya).

There is no generic `host` role, no second administrator, no moderator role, and no way for Liza, Viktor, or guests to acquire admin permissions from the UI.

Public sign-up for administrative accounts is disabled.

The database stores the single owner user id on the event, for example:

- `events.owner_user_id = <Supabase auth.uid() of Ilya>`

All privileged mutations must verify server/database-side that:

- `auth.uid() = events.owner_user_id`

This check is enforced with Supabase RLS and/or security-definer RPCs where needed. Hiding admin buttons in the frontend is not considered security.

## 2. Role boundaries

### Owner/Admin — Ilya only

May:

- open `/admin`
- edit questions
- start/stop/reveal games
- control the projector state
- manage Mortal Kombat bracket and winners
- control video premiere/countdown/playback state
- reset modules/event state
- generate/revoke Liza and Viktor access links
- manage media

### Liza

Uses a separate scoped QR/token experience. She can only read the public/current activity state needed for her screen and submit/update her own private answer where applicable.

She cannot:

- access admin data
- reveal answers
- advance questions
- control the projector
- edit content
- manage tournament results
- start the premiere

### Viktor

Same restrictions as Liza, scoped only to Viktor's own participant actions.

### Guests

Anonymous/public participant access only. Guests can join, vote, view allowed public results/brackets, and participate in enabled games. No administrative mutations.

### Projector

Presentation-only UI. No visible controls and no administrative mutation actions from the `/screen` interface.

## 3. Same owner account on phone and laptop

Ilya signs into the same owner/admin account on both devices:

- phone = control device
- laptop = presentation/display device connected to TV/projector

Both sessions may be active simultaneously under the same Supabase Auth user.

The laptop normally stays on `/screen` in fullscreen. The phone stays on `/admin`.

The laptop does not need to be operated during each game once `/screen` is open and connected.

## 4. Separate "output to screen" control

The admin phone UI must have a dedicated screen-control area and an obvious primary action such as:

- `ВЫВЕСТИ НА ЭКРАН`

The laptop's `/screen` subscribes to the event's realtime `screen_state` and changes automatically when Ilya selects what should be shown from the phone.

Examples:

- question selected on phone → press `ВЫВЕСТИ НА ЭКРАН` → laptop shows that question
- results ready → press `ПОКАЗАТЬ РЕЗУЛЬТАТ` → laptop reveals results
- Mortal Kombat → press `ВЫВЕСТИ СЕТКУ` → laptop changes to tournament bracket
- current fight → press `ВЫВЕСТИ БОЙ` → laptop focuses on that match
- premiere → press `ПОДГОТОВИТЬ ПРЕМЬЕРУ` → laptop enters black/preload state
- press `НАЧАТЬ ПРЕМЬЕРУ` on phone → laptop runs synchronized 10→1 countdown and starts the video
- press `ЧЁРНЫЙ ЭКРАН` → laptop immediately becomes black
- press `ГЛАВНЫЙ ЭКРАН` → laptop returns to celebration hub state

No physical interaction with the laptop should be required for normal switching between these presentation states.

## 5. Browser fullscreen and audio exception

Browsers restrict remote entry into fullscreen and autoplay with sound. Therefore, before the event/public premiere, Ilya performs one local setup action on the laptop:

1. sign into the same owner account;
2. open `/screen`;
3. click `ПОДКЛЮЧИТЬ ЭКРАН` / enter browser fullscreen;
4. arm audio/playback once if the browser requires a user gesture.

After this one-time preparation, normal event control comes from the phone through realtime state.

The admin phone must show connection/preflight indicators:

- `Экран подключён`
- `Видео готово`
- `Звук разрешён`

The premiere launch button remains disabled until required preflight conditions are satisfied.

## 6. Screen state model

`event_state` should include a presentation state, for example:

- `screen_mode`: `hub | question | results | couple_reveal | tournament_bracket | tournament_match | premiere_standby | premiere_countdown | premiere_playing | black`
- `screen_payload_id`: optional question/match/media identifier
- `screen_updated_at`
- `premiere_start_at`

Only the owner/admin may mutate these fields.

Guest, Liza, Viktor, and projector clients may only read the public projection of the state they need.

## 7. Security requirements

Required tests/contracts:

- an anonymous guest cannot call any admin mutation;
- a valid Liza token cannot call any admin mutation;
- a valid Viktor token cannot call any admin mutation;
- knowing `/admin` URL is insufficient without the owner's authenticated session;
- no public admin registration exists;
- only the event `owner_user_id` can mutate `screen_state`;
- only the event `owner_user_id` can edit questions or tournament results;
- only the event `owner_user_id` can start/cancel/control the premiere;
- Liza and Viktor role tokens are never interpreted as admin credentials;
- `/screen` exposes presentation data only and contains no mutation controls;
- owner sessions on phone and laptop stay synchronized through the same event state.

## 8. Terminology update

From implementation onward, use:

- `owner` / `admin` = Ilya only
- `liza` = Liza participant role
- `viktor` = Viktor participant role
- `guest` = public guest participant
- `screen` = read-only presentation client

Do not introduce a reusable `host` role unless the owner explicitly requests it later.
