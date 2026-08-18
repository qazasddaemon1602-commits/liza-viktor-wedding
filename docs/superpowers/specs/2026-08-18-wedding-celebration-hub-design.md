# Liza & Viktor — Wedding Celebration Hub

Date: 2026-08-18
Status: Approved concept, pending implementation plan

## 1. Goal

Build a mobile-first celebration web app for the second day of Liza and Viktor's wedding, designed for ~40 guests. The site is not a single quiz: it is the central digital hub for multiple party activities, with a host/admin control center, guest participation from phones via QR, private participant views for Liza and Viktor, a projector screen mode, a video premiere module, and a Mortal Kombat tournament module.

The system should be modular so additional contests can be added later without redesigning the core architecture.

## 2. Product principles

- Guests must be able to join in seconds from a QR code without creating accounts.
- The host controls the pace of live activities.
- Guest, Liza, Viktor, host, and projector experiences are separate.
- Hidden answers remain hidden until the host reveals them.
- The projector view is presentation-only and readable across a room.
- The site should feel premium, modern, playful, and event-specific rather than like a generic wedding template.
- All live games use persistent realtime state so refreshing a phone does not destroy the event flow.

## 3. Recommended stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Realtime
- Supabase Storage for the premiere video and future media
- QR codes generated client-side from role-specific URLs

Supabase is preferred because the project needs realtime voting, persistent event state, admin editing, private role answers, and future expansion.

## 4. Roles

### Guest

Entry through the public QR/link. Guest enters a nickname, receives a browser/device identity, and participates in currently active games.

No account required.

### Liza

Private role screen opened from a dedicated QR/deep link. Access is protected by a role token or PIN. Liza can answer couple-only questions privately and participate in future bride-specific activities.

### Viktor

Same model as Liza, with his own private QR/deep link and isolated answer state.

### Host/Admin

Private admin dashboard protected by a PIN or authenticated role. Host can launch modules, advance questions, reveal answers, manage tournament state, control the video premiere, edit questions, see participation status, and reset game state.

### Projector / Screen

Read-only fullscreen route for TV/projector. No controls. Shows the active module and reacts instantly to host actions.

## 5. Primary routes

- `/` — celebration hub / join screen
- `/play` — guest live game experience
- `/liza` — Liza private role screen
- `/viktor` — Viktor private role screen
- `/host` — host control panel
- `/admin` — full content and module management
- `/screen` — projector-only output
- `/premiere` — video premiere presentation route
- `/mortal-kombat` — tournament page for players/guests
- `/mortal-kombat/screen` — tournament bracket on projector

Route access may use signed/unguessable role tokens where appropriate.

## 6. Celebration hub

The homepage is a modular activity hub.

Initial cards:

1. `Кто из них?` — active
2. `Премьера` — active for host-controlled playback
3. `Mortal Kombat — 16 игроков` — active
4. Future activity placeholders — `Скоро`

Guests should not see host/admin tools.

## 7. Module 1 — Live "Liza or Viktor" voting

### Guest flow

- Host activates a question.
- Guest sees the question and two large answer cards: `ЛИЗА` and `ВИКТОР`.
- One vote per device per question.
- After voting, the choice locks.
- Results remain hidden until the host reveals them.
- Guest sees a waiting state such as `Ждём остальных…`.

### Host flow

Host sees:

- current question
- total connected guests
- number who voted
- live participation count
- next / previous
- reveal / hide results
- reset current question
- reset module

### Projector flow

Before reveal:

- huge question
- `Ответили 31 / 40`
- no percentages

After reveal:

- animated Liza/Viktor split
- vote percentages and counts

## 8. Module 2 — Final five couple-reveal questions

Seed questions:

1. Кто главный?
2. Кто первым мирится?
3. Кто транжира?
4. Кто заведёт ещё одно животное?
5. Кто кого больше избаловал?

Mechanic:

1. Guests vote `ЛИЗА` or `ВИКТОР`.
2. At the same time, Liza privately answers from her phone.
3. Viktor privately answers from his phone.
4. Neither sees the other's answer.
5. Host sees only status indicators: `Лиза ответила`, `Виктор ответил`.
6. Host presses `Показать`.
7. Projector reveal sequence:
   - guest percentages
   - Liza's choice
   - Viktor's choice
   - playful verdict

Example verdicts:

- `Совпали. Невероятно.`
- `Семейная дискуссия официально открыта.`
- `Гости, кажется, знают их лучше.`

The site should support both digital reveal and the physical-card version where Liza and Viktor hold up cards at the same moment.

## 9. Module 3 — Video premiere

The supplied wedding-track video `КОЛЬЦО.mp4` is the initial premiere asset. Inspected source properties:

- duration: 10:23 (623 seconds)
- resolution: 1920×1080
- frame rate: 30 fps
- video codec: H.264
- audio codec: AAC
- source size: approximately 263 MB

The video is used as a deliberate premiere moment rather than ordinary embedded media.

### Premiere sequence

The normal premiere sequence is host-controlled:

1. Host opens/arms Premiere mode.
2. Projector switches to a clean black cinematic state and preloads/buffers the video.
3. Projector audio/fullscreen capability must already be armed by a one-time local interaction before the public moment, so browser autoplay restrictions cannot ruin the start.
4. Host presses `НАЧАТЬ ПРЕМЬЕРУ`.
5. A synchronized 10-second countdown starts on the projector: `10 → 9 → 8 → ... → 1`.
6. At the end of `1`, the countdown disappears and `КОЛЬЦО` starts immediately with no extra title card or dead pause.
7. After the video ends, projector moves to a configurable dark final state and stays there until the host chooses what comes next.

Do not render `0`; playback begins directly after `1`.

### Countdown visual treatment

The countdown should feel cinematic and appropriate to the premium dark visual language rather than like a sports timer or game-show graphic.

Recommended initial treatment:

- nearly black background
- very large centered number
- warm ivory/soft white typography
- subtle scale/fade pulse on each second
- restrained thin progress ring or line is allowed
- optional small caption `ПРЕМЬЕРА ЧЕРЕЗ`
- final three seconds may gain slightly more visual/audio tension, but no aggressive flashing
- no confetti, hearts, neon arcade styling, alarm sound, or cheesy countdown effects

Countdown sound should be configurable. Default MVP may use a restrained low pulse/tick, with a mute option. The wedding video audio begins cleanly at playback start.

### Synchronization model

Do not send ten separate realtime commands. The host writes a future `premiere_start_at` timestamp approximately 10 seconds ahead. The projector receives that timestamp through realtime state and renders the remaining countdown from the authoritative start time. At `premiere_start_at`, the preloaded media starts.

This avoids visible drift from network latency and makes projector refresh/reconnect behavior recoverable.

### Host controls

- choose/load premiere video
- run preflight check
- arm projector/audio
- enter black standby state
- `НАЧАТЬ ПРЕМЬЕРУ` with 10-second countdown
- cancel countdown before playback if something goes wrong
- pause/resume
- restart
- seek if necessary
- enter/exit fullscreen presentation state
- return projector to hub only by explicit host action

The host screen should visibly report `Видео готово`, `Звук разрешён`, and projector connection status before enabling the main premiere button.

### Projector experience

Before countdown:

- black/dark cinematic screen
- optional minimal `ПРЕМЬЕРА` standby title
- no browser chrome or admin controls

During countdown:

- only the cinematic countdown layer
- video remains preloaded underneath, not visibly playing

At start:

- video begins fullscreen immediately after `1`
- audio plays through the connected room system/device
- playback controls remain hidden on `/screen`/`/premiere`

After playback:

- configurable end frame, initially a simple dark final state
- return to celebration hub only when host chooses

### Media handling

The actual 263 MB source video must not be committed to GitHub. Store it in Supabase Storage or another deploy-safe media/CDN location. Admin should be able to replace the file without code changes later.

Before the event, verify real streaming behavior from the venue connection. If needed, create an optimized web delivery copy while keeping the supplied source file as the master.

The video module is independent from the quiz and tournament so it can be triggered at any point during the event.

## 10. Module 4 — Mortal Kombat tournament

Tournament is for the current/new Mortal Kombat game the user already owns. The website does not run the game itself; it manages participants, bracket, match state, and projector presentation.

### Format

- 16 players
- single-elimination bracket
- Round of 16 → Quarterfinals → Semifinals → Final
- optional third-place match may be added later, not required for MVP

### Registration

Host can:

- add players manually
- allow guests to claim tournament slots from phones if registration is opened
- close registration at 16 players
- reorder participants before draw
- randomize bracket

Each participant has:

- display name
- optional nickname
- seed/order
- status: active / eliminated / champion

### Match flow

Host selects a match and can:

- mark it `Сейчас играют`
- record winner
- undo winner if entered incorrectly
- automatically advance winner to next round

No gameplay scoring integration is required for MVP; the host records the actual console match result manually.

### Guest page

Guests can see:

- current bracket
- next/current match
- participants
- tournament progress
- champion once complete

### Projector page

Large bracket optimized for 16:9 display. It should emphasize:

- current match
- next match
- current round
- progressing winners
- final champion reveal

The projector view should avoid tiny bracket text. If necessary, use a focused round view rather than displaying every node at once on smaller screens.

### Future options

Architecture should allow later additions such as:

- best-of-3 match setting
- character selection notes
- spectator predictions
- side bets with non-monetary event points
- player profile photos

These are explicitly outside the first MVP.

## 11. Admin dashboard

Admin is the control center for the whole event.

Main dashboard shows:

- current active module
- connected guest count
- active question / current match / premiere state
- quick launch buttons
- QR panel for Guest / Liza / Viktor

Admin sections:

### Questions

- add
- edit
- delete
- reorder
- enable/disable
- type: standard vote / couple reveal

### Live game control

- activate question
- reveal
- next/previous
- reset

### Couple status

- Liza connected/answered
- Viktor connected/answered
- actual answers hidden until reveal

### Mortal Kombat

- participant list
- registration open/closed
- randomize bracket
- start tournament
- record winner
- undo result
- reset tournament

### Premiere

- set video source
- test/preflight video
- confirm projector/audio armed
- black standby
- launch 10-second countdown
- cancel countdown
- start/pause/restart
- fullscreen screen state

### Event safety

Destructive reset actions must require confirmation.

## 12. Data model

Suggested tables/entities:

### `events`
- id
- name
- status
- active_module
- created_at

### `event_state`
- event_id
- current_module
- current_question_id
- reveal_state
- screen_state
- premiere_state
- premiere_start_at
- updated_at

### `guests`
- id
- event_id
- nickname
- device_key
- last_seen_at

### `role_access`
- id
- event_id
- role (`liza`, `viktor`, `host`)
- token_hash / PIN configuration
- enabled

### `questions`
- id
- event_id
- text
- type (`standard`, `couple_reveal`)
- sort_order
- enabled

### `votes`
- id
- event_id
- question_id
- guest_id/device_key
- choice (`liza`, `viktor`)
- created_at

Unique constraint: one guest/device vote per question.

### `couple_answers`
- id
- event_id
- question_id
- role (`liza`, `viktor`)
- choice
- created_at

Unique constraint: one answer per role per question.

### `media_items`
- id
- event_id
- type (`premiere_video`)
- storage_path
- title
- duration_seconds
- enabled

### `tournament_players`
- id
- event_id
- display_name
- seed
- status

### `tournament_matches`
- id
- event_id
- round
- bracket_position
- player1_id
- player2_id
- winner_id
- status

## 13. Realtime data flow

- Host actions update central event state.
- Guest/Liza/Viktor/projector clients subscribe to realtime event-state changes.
- Votes update participation counts in realtime.
- Couple answers send only answer-status information to host until reveal.
- Tournament result updates propagate immediately to bracket views.
- Premiere start uses one authoritative future `premiere_start_at` timestamp; projector derives the visible 10-second countdown and playback boundary from that timestamp.
- Exact media playback remains owned by the projector client after it has been preflighted/armed.

## 14. Security and access

- Public guests can only access public event state and submit their own votes.
- Public clients cannot read hidden couple answers before reveal.
- Liza and Viktor can only submit/update their own role answers.
- Host/admin mutations require protected access.
- Projector is read-only.
- Use Supabase RLS for data boundaries, not only client-side UI hiding.
- Role QR tokens must be unguessable and revocable.

## 15. Visual design

Direction:

- dark charcoal / black base
- warm ivory typography
- restrained two-color differentiation for Liza and Viktor
- large typography
- premium editorial spacing
- subtle motion
- small retro-game Easter eggs allowed

Avoid:

- hearts everywhere
- flowers
- pink wedding clichés
- cartoon wedding graphics
- generic template appearance

### Mobile

Guest action buttons must be large, thumb-friendly, and fast.

### Projector

Text must be readable from across the room. Projector routes prioritize one idea per screen over dashboard density.

## 16. Error handling

- If realtime connection drops, show a non-blocking reconnect state and resubscribe automatically.
- Prevent duplicate guest votes at database level.
- Tournament winner updates must be reversible from admin.
- If premiere video fails to load or buffer, host gets a clear preflight error before public countdown can start.
- Premiere cannot enter the public countdown unless projector/audio has been armed successfully.
- Host can cancel countdown before playback begins.
- Liza/Viktor answer submission should confirm locally after persistence succeeds.
- Projector refresh must restore current event state from database.

## 17. Testing strategy

Minimum automated coverage:

- one vote per guest/device per question
- reveal hides couple answers before host action
- Liza and Viktor cannot read one another's hidden answer
- host can reveal only valid current question state
- bracket generation produces 8 Round-of-16 matches for 16 players
- winner advancement maps to correct next-round slot
- undo result restores bracket safely
- projector state survives refresh
- premiere preflight/armed state works
- one future premiere timestamp yields the expected `10...1 → playback` transition
- countdown cancellation prevents playback
- premiere command/state transitions work

Manual event QA:

- test with multiple phones simultaneously
- test Liza and Viktor on separate phones
- test host + projector on separate devices
- test ~40 concurrent simulated/real guest sessions
- test projector at 16:9
- test `КОЛЬЦО` end-to-end with real venue internet and audio path before the event
- test that browser autoplay restrictions cannot block the armed premiere flow

## 18. MVP scope

MVP must include:

- celebration hub
- guest join
- standard Liza/Viktor voting
- final five couple-reveal questions
- separate Liza and Viktor private screens
- host/admin controls
- projector screen
- QR links
- realtime persistence
- video premiere module with preflight and cinematic 10-second countdown
- 16-player Mortal Kombat bracket and host result entry

Out of scope for first MVP:

- user accounts for guests
- payments
- native mobile apps
- automated console/game integration
- AI-generated commentary
- public social sharing
- advanced tournament formats

## 19. Future modules

The architecture should allow additional event games such as:

- quiz about the couple
- photo challenge
- music guessing game
- anonymous stories
- guest predictions
- team scoring
- raffle
- event points / leaderboard

Each future activity should plug into the hub and use the same event, role, realtime, projector, and admin foundations.

## 20. Acceptance criteria

The first implementation is successful when:

1. ~40 guests can join by QR without accounts.
2. Host can control live questions and projector output.
3. Guest votes update reliably in realtime.
4. Liza and Viktor can answer privately from separate QR routes.
5. Hidden answers are not exposed before reveal.
6. Final-five reveal works cleanly on projector.
7. Host can preflight and trigger `КОЛЬЦО` with a synchronized cinematic 10-second countdown and immediate playback after `1`.
8. A 16-person Mortal Kombat bracket can be created, progressed, corrected, and completed to a champion.
9. Projector state survives refresh/reconnect.
10. The architecture can accept more contest modules later without replacing the core app structure.
