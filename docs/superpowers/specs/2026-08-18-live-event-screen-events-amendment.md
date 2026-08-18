# Amendment — Live event moments on the main screen

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Turn the main `/screen` idle experience into a live event display that reacts to meaningful moments throughout the second wedding day without becoming noisy or interrupting important content.

The screen should surface short, stylish event moments when something notable happens, then smoothly return to the idle QR state.

## Event moment examples

Automatic or owner-triggered moments can include:

- new guest registered
- guest assigned to a carriage/team
- carriage reaches a notable count / registration milestone
- Mortal Kombat registration opens
- Mortal Kombat reaches 8 / 12 / 16 players
- bracket draw completed
- current Mortal Kombat match announced
- match winner recorded
- semifinalists determined
- finalists determined
- Mortal Kombat champion crowned
- live quiz voting opened
- all/most guests answered
- quiz result revealed
- guest majority matches the couple's pre-answer
- guest majority differs from the couple's pre-answer
- a carriage/team is called to an activity
- premiere is armed / countdown starts
- wedding video finishes
- owner-created custom announcement

## Visual behavior

Event moments use the same refined wedding visual system: warm ivory, deep green, cinnamon, restrained wine red, premium typography and subtle motion.

Do not use generic notification toasts on the projector. Each moment should feel like a designed mini-scene.

Typical duration:
- minor moment: 3–4 seconds
- medium moment: 4–6 seconds
- major moment (finalist/champion/result): 6–10 seconds

Examples:

`НОВЫЙ ПАССАЖИР`
`ИВАН П. → ВАГОН №3`

`В СОСТАВЕ УЖЕ 30 ГОСТЕЙ`

`MORTAL KOMBAT`
`16 ИГРОКОВ. СЕТКА ЗАКРЫТА.`

`ПОБЕДИТЕЛЬ БОЯ`
`СЕРГЕЙ → 1/4 ФИНАЛА`

`ФИНАЛ`
`АЛЕКСЕЙ × МАКСИМ`

`ЧЕМПИОН`
`МАКСИМ`

`НАРОД РЕШИЛ`
`67% — ЛИЗА`

`ЛИЗА И ВИКТОР СЧИТАЮТ ИНАЧЕ`

## Priority system

Screen events must have priorities.

### Priority 1 — ambient
Can appear only while `/screen` is in idle QR/home mode.
Examples: guest registration, counts, light status moments.

### Priority 2 — activity moments
Can appear during the relevant module when they belong to that module.
Examples: MK winner, quiz result, carriage call.

### Priority 3 — protected modes
Must never be interrupted by automatic event moments:
- premiere countdown
- premiere playback
- black screen mode
- manually pinned owner screen
- critical reveal animation already in progress

If an event occurs while the screen is protected, queue it or suppress it depending on event relevance.

## Queueing

Events must never visually collide.

- Maintain a short presentation queue.
- Show one event at a time.
- Registration animations can queue if several guests register together.
- Low-priority duplicate milestones may be collapsed.
- Owner can clear the queue from `/admin`.
- Owner can disable automatic screen events globally at any time.

## Sound

Selected event moments may include subtle sound cues.

Examples:
- new passenger: restrained train chime / soft horn
- match winner: short impact/chime
- quiz reveal: subtle reveal cue
- champion: slightly larger celebratory cue

Sound must remain restrained and configurable from admin.

No automatic sound should play during premiere playback or another protected media state.

## Owner controls

Admin `/admin` should include a `СОБЫТИЯ ЭКРАНА` area with:

- automatic events on/off
- screen sounds on/off
- current event
- queued events count
- clear queue
- replay last event
- send custom event/announcement
- pin/unpin current screen

Owner can manually trigger major screen moments even if the automatic trigger is disabled.

## Data model

Suggested `screen_events` table:
- `id`
- `event_id`
- `type`
- `priority`
- `payload jsonb`
- `sound_key` nullable
- `status` (`queued`, `showing`, `shown`, `suppressed`)
- `created_at`
- `shown_at` nullable
- `expires_at` nullable

This provides a durable realtime event queue and allows refresh/reconnect without duplicating already shown events.

## Privacy

Public screen moments should avoid exposing unnecessary personal information.

For guest registration, default presentation should use first name + surname initial (`Иван П.`) unless owner explicitly chooses a different display rule.

Private registration metadata such as side/relationship notes remain owner-only.

## Acceptance criteria

1. Meaningful event actions can generate short realtime screen moments.
2. Main screen returns smoothly to idle QR after ambient moments.
3. Automatic moments never interrupt premiere playback/countdown or owner-pinned protected states.
4. Multiple simultaneous events queue rather than overlap.
5. Owner can disable, clear, replay and manually trigger events from phone.
6. Sound cues are restrained, optional and never interfere with protected media.
7. Screen events follow the wedding visual identity rather than looking like generic web notifications.
