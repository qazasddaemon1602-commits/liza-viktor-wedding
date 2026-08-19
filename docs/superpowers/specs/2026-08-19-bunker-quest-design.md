# Bunker Quest — design spec

Date: 2026-08-19
Status: approved direction, implementation-ready
Event: `liza-viktor`

## Goal

Turn the existing Bunker emergency takeover into a complete 30-minute digital quest that runs through the same wedding site, shared TVs, owner admin, and the guest cabinet.

The Bunker must feel like a separate dramatic world without becoming a separate app. The existing emergency takeover, sound, screen priority, and 30:00 authoritative timer remain the story trigger. After the trigger, guests receive personal dossiers and carriage-based team missions on their phones. The five carriages cooperate to assemble a final access code before or after arrival.

## Non-negotiable behavior

- One press by the owner starts the story turn on all shared TVs.
- The emergency copy remains:
  - `ЭКСТРЕННОЕ СООБЩЕНИЕ`
  - `ПОЕЗД ИЗМЕНИЛ МАРШРУТ.`
  - `ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА — БУНКЕР.`
  - `ВРЕМЯ ДО ПРИБЫТИЯ: 30:00`
- The Bunker keeps the highest shared-screen priority. Quiz, carriage announcements, Mortal Kombat, and Premiere cannot take over while Bunker is protected.
- The global timer is server-authoritative and starts with the emergency trigger.
- At `00:00` the Bunker stays active until the owner explicitly stops it. The timer must never silently dismiss the takeover.
- No traitors, no guest elimination, no voting people out.
- Existing wedding guests do not create another account or profile.
- Each carriage is a team. No separate team-registration flow.
- Guest phones automatically show Bunker content inside the persistent guest cabinet; no manual navigation is required.
- Rehearsal reset clears disposable Bunker quest data while preserving couple preanswers and other explicitly preserved configuration.

## Experience flow

### Phase 0 — idle

The guest cabinet behaves normally. Owner sees the Bunker dock as armed/ready. TVs show the normal event presentation.

### Phase 1 — emergency

Owner launches Bunker. Existing `bunker_state` becomes active and the 30-minute timer starts.

TV:
- full-screen emergency takeover;
- large countdown;
- alert sound if enabled;
- archive/observatory visual language, not red sci-fi HUD.

Guest phone:
- Bunker card takes priority over Quiz/carriage calls in `Сейчас происходит`;
- copy tells the guest that the route changed and to keep the phone open;
- no task is required until the owner starts the first quest phase.

Owner:
- sees timer, five carriage statuses, sound switch, stop/restart controls;
- gets a single `НАЧАТЬ КВЕСТ` action after the emergency announcement has landed.

### Phase 2 — dossier I

Starting the quest creates a stable personal dossier for every currently registered guest. Late guests who register while Bunker is active receive a dossier on first Bunker load.

Each guest sees:
- profession;
- age/profile descriptor;
- locked sections for later reveals;
- carriage/team number;
- short instruction to compare dossiers with teammates.

No characteristic excludes a player or determines whether they can remain in the game.

### Phase 3 — dossier II / hidden reveal

Owner reveals the second layer to everyone at once.

Each dossier expands with:
- health/condition;
- hobby/skill;
- baggage;
- hidden fact/talent.

The reveal is a story beat and can be triggered manually even if some phones were offline. Returning phones reconstruct the correct phase from backend state.

### Phase 4 — team mission A

Each carriage receives one carriage-specific mission. Any member of the carriage may submit an answer. A correct answer completes the mission for the entire carriage and all team phones update.

Mission A is a short scenario/logic choice designed for group discussion rather than individual trivia. Five variants are seeded, one per carriage.

Owner can:
- see correct/incorrect attempts without exposing the answer on guest phones;
- reset a carriage mission;
- force-complete a carriage if a device/network problem blocks progress.

When all five carriages complete Mission A, admin highlights `ВСЕ ВАГОНЫ ГОТОВЫ`; progression remains manual so the host controls pacing.

### Phase 5 — team mission B

A second carriage-specific puzzle is unlocked. It is more code-oriented and leads to a reward fragment.

When a carriage completes Mission B it receives a two-digit access fragment. The fragment is visible to all members of that carriage and persistent across refreshes.

The five fragments are intentionally insufficient in isolation. Guests must communicate between carriages to assemble the final code in carriage order `1 → 2 → 3 → 4 → 5`.

### Phase 6 — final access

All guest cabinets show the final access terminal.

- Any registered guest may enter the assembled code.
- Wrong codes can be retried and return a neutral error; there is no lockout that could break the event.
- The first correct full code sets a single global `unlocked` state.
- All phones and TVs update through Realtime plus polling fallback.
- Owner also has `ОТКРЫТЬ ВРУЧНУЮ` as an emergency fallback.

If the code is solved before `00:00`, the status becomes `ДОСТУП ПОЛУЧЕН · ОЖИДАЕМ ПРИБЫТИЕ` while the arrival timer keeps running.

At `00:00`:
- if unlocked: TV shows `ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН`;
- if still locked: TV shows `ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН` and guest code entry remains usable;
- Bunker remains protected until owner presses STOP.

### Phase 7 — completed / owner stop

Owner stops Bunker. Shared TVs return to the normal event screen. Guest cabinet keeps a compact completed-event record but removes the full takeover.

## Character system

Dossiers are generated from independent content pools instead of maintaining hundreds of hand-authored full characters. This produces many combinations while keeping content manageable and testable.

Pools:
- 30+ professions;
- 24+ age/profile descriptors;
- 30+ health/condition entries;
- 30+ hobbies/skills;
- 30+ baggage entries;
- 30+ hidden facts/talents.

Content rules:
- playful and wedding-appropriate;
- no humiliating medical diagnoses, protected-class jokes, sexual content, or targeted insults;
- enough useful, strange, and funny combinations to provoke discussion;
- no traitor/saboteur mechanics.

Assignments are persisted per guest for the current run. Reloading must never reroll a dossier.

## Mission content

Mission templates are data, not UI logic. Seed exactly two mission stages × five carriages for the first production version.

Each template contains:
- stage;
- carriage number;
- title;
- prompt;
- optional answer choices;
- normalized correct answer;
- success copy;
- hint copy for owner use.

Mission A should be fast group reasoning (rough target: 2–4 minutes).
Mission B should be a compact cipher/logic problem (rough target: 3–6 minutes) and unlock the carriage fragment.

The system supports replacing mission text later without changing frontend state logic.

## Data model

Keep existing `bunker_state` as the authoritative event-level runtime row and extend it rather than creating a parallel timer system.

Add to/alongside Bunker state:
- `phase` — `emergency | dossier_1 | dossier_2 | mission_a | mission_b | final | completed`;
- `phase_started_at`;
- `unlocked_at`;
- `run_nonce` or equivalent stable run identifier;
- generated final-code metadata stored server-side only.

New table `bunker_guest_profiles`:
- event/run id;
- guest id (unique per run);
- profession;
- profile/age;
- health;
- hobby;
- baggage;
- hidden fact;
- created_at.

New table `bunker_mission_templates`:
- stage;
- carriage number;
- title/prompt/options;
- correct answer;
- success/hint content.

New table `bunker_team_progress`:
- event/run id;
- carriage id;
- stage;
- completed_at;
- completed_by_guest_id;
- attempt count;
- reward fragment for Mission B.

New table `bunker_final_attempts` or action log records final submissions without exposing the real code to clients.

All new tables use RLS with direct public/anon/authenticated table access revoked. Guest and owner operations go through `security definer` RPCs.

## RPC contract

Guest/public-with-device-key:

`get_guest_bunker_state(p_event_slug, p_device_key)`
- validates the existing guest/device binding;
- lazily ensures a dossier exists when Bunker is active;
- returns current phase, timer, personal dossier fields allowed for that phase, carriage mission/progress, reward fragment when earned, global final status, and server time.

`submit_guest_bunker_mission(p_event_slug, p_device_key, p_stage, p_answer)`
- only accepts the current mission phase;
- normalizes answer server-side;
- marks carriage complete only on a correct answer;
- never returns the stored correct answer on failure.

`submit_guest_bunker_final_code(p_event_slug, p_device_key, p_code)`
- only valid in final phase;
- atomically sets global unlock on first correct submission;
- idempotent after success.

Owner:

`owner_get_bunker_quest(p_event_id)`
- returns timer, phase, five carriage progress summaries, attempt counts, unlock state, and owner-only hints.

`owner_begin_bunker_quest(p_event_id)`
- moves emergency → dossier I and ensures profiles/fragments exist.

`owner_advance_bunker_phase(p_event_id, p_phase)`
- explicit valid transitions only;
- owner controls pacing.

`owner_reset_bunker_team_stage(p_event_id, p_carriage_id, p_stage)`
- clears one disposable carriage mission result.

`owner_force_complete_bunker_team_stage(...)`
- emergency operational fallback.

`owner_unlock_bunker(p_event_id)`
- emergency manual final unlock.

Existing `owner_start_bunker`, `owner_stop_bunker`, `owner_set_bunker_sound`, and screen-state RPC behavior remain compatible.

## Realtime and fallback

Use the existing Bunker refresh channel. Broadcasts contain only a refresh signal, never secret answers or final code.

Every consumer reloads authoritative backend state after a signal.

Fallback:
- guest cabinet polls while Bunker is active if Realtime is degraded;
- shared TV keeps its existing authoritative reload/fallback behavior;
- owner commands are considered successful from RPC result even if broadcast fails, with a warning rather than a duplicate command.

## Guest cabinet integration

Bunker has highest activity priority in `GuestLiveActivity` while active.

The cabinet keeps the ticket available below/around the active module, but the live Bunker card is visually dominant.

Sections:
- emergency notice;
- personal dossier with progressive locked/revealed rows;
- current carriage mission;
- team completion state;
- earned fragment;
- final code input;
- completed state.

When Bunker ends, the cabinet returns to the normal Quiz/MK/event flow without navigation.

## Shared-TV integration

`BunkerScreenGuard` remains the single protection boundary.

Scene variants inside the guard:
- emergency takeover;
- dossier briefing;
- mission board with five carriage progress markers;
- final access board with five fragment slots shown as locked/unlocked (never reveal fragment digits on TV before final success);
- arrival locked/unlocked result.

The global timer remains visible through all active quest phases.

Visual direction:
- black / warm off-white / grayscale;
- archive, observatory, concrete/brutalist editorial language;
- huge typography + tiny mono system labels;
- grain, technical grid, dossier stamps;
- no neon esports UI and no bright red sci-fi HUD.

## Owner admin

Expand the existing `AdminBunkerControl` rather than adding a second disconnected owner page.

Owner view contains:
- global timer and current phase;
- five carriage progress cards;
- next-phase action;
- reveal control;
- per-carriage reset/force-complete actions;
- final unlock fallback;
- existing restart/stop/sound controls.

Dangerous actions keep a compact confirmation state. Normal next-phase actions do not require repeated confirmation.

## Reset and rehearsal

`owner_reset_event_test_data` must additionally clear:
- Bunker guest profiles;
- team mission progress;
- final attempts/unlock state;
- current phase back to idle/emergency defaults.

It must preserve the existing intended preserved data, especially couple preanswers.

Repeated rehearsal must produce a fresh Bunker run and may generate new dossiers/fragments after the reset.

## Late guests and reconnects

Late guest during active Bunker:
- receives normal wedding registration/ticket;
- cabinet immediately loads active Bunker;
- backend lazily creates their dossier;
- they join their assigned carriage's current team state without resetting team progress.

Reconnect:
- no client-local phase assumptions;
- server returns exact timer and phase;
- earned fragment and global unlock state are recoverable.

## Testing strategy

Development workflow follows the requested faster pattern:
- targeted unit/service tests while implementing individual pieces;
- database pgTAP for new security/RPC contracts;
- no full E2E after every small commit;
- one final PR merge gate runs full CI + database + Playwright.

Focused E2E for the package covers:
1. register at least two guests in different carriages;
2. owner starts Bunker;
3. guest cabinet receives emergency automatically;
4. owner begins quest and dossiers appear;
5. reveal phase updates guests;
6. carriage mission completion is shared across team;
7. reward fragments unlock;
8. correct final code produces global unlock;
9. shared TV reflects final state;
10. owner stop restores normal presentation;
11. reset clears Bunker quest runtime.

## Explicitly out of scope for this package

- traitors/saboteurs;
- guest elimination;
- public ranking/leaderboard;
- native push notifications when the website/PWA is fully closed;
- paid SMS/Telegram integrations;
- AI-generated mission evaluation;
- more than two team mission stages;
- a separate Bunker login/account.

These can be added later without changing the core state machine.
