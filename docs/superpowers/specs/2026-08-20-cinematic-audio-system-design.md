# Cinematic Audio System — Design Spec

Date: 2026-08-20
Project: Love Story Live / liza-viktor.site
Status: approved concept, implementation not started

## Goal

Make sound a first-class part of the wedding live experience without turning the site into a noisy mobile game. The desired character is cinematic, atmospheric, physical, and train-inspired where appropriate. Sound should reinforce important actions, scene changes, tension, confirmation, and celebration.

The system must work across the main `/screen` experience and guest phones, degrade safely when browser autoplay is restricted, and never make an event control unusable merely because audio is unavailable.

## Core principles

1. **Cinematic, not arcade-first.** Main wedding, train, quiz, registration, premiere, and bunker sounds should feel cinematic and tactile. Mortal Kombat may use a more stylized arcade/impact palette, but still with cinematic weight rather than cheap 8-bit beeps.
2. **Sound supports hierarchy.** Major moments get strong cues. Ordinary taps get very quiet feedback. Ambient layers must not compete with speech, music, or the couple's premiere track.
3. **Sound defaults ON.** The UI preference is ON by default. Browsers may still require the first user gesture before actual WebAudio/media playback; the first interaction should unlock audio automatically when possible.
4. **Mute means mute.** A single user-facing sound toggle must silence all site-generated cues on that device: UI clicks, train cues, countdown ticks, alerts, and scene effects. Premiere media follows the existing projector mute behavior.
5. **Readiness is advisory.** Audio readiness/presence can be displayed in admin, but it must never block manual event controls.
6. **No permanent background music.** Continuous music across the whole site is out of scope. Atmosphere appears at selected moments so important sounds keep their impact.
7. **Local reliability.** Critical sound assets should ship with the app or be hosted under controlled project storage, not depend on random third-party URLs at event time.

## Architecture

Introduce one shared audio service for site-wide interaction sounds, with scene-specific adapters for richer cues.

### 1. Shared UI audio engine

A new `siteAudio` module will own:

- one reusable `AudioContext` per page/device;
- the global `soundEnabled` preference;
- automatic unlock attempts after the first pointer/keyboard interaction;
- lightweight generated UI cues using WebAudio;
- concurrency rules so many taps do not stack into harsh noise;
- volume normalization by cue category;
- safe no-op behavior when audio is unsupported or blocked.

Suggested cue API:

- `tap()` — very quiet tactile click for ordinary buttons;
- `select()` — option/radio/answer choice;
- `confirm()` — successful submit/action;
- `success()` — stronger positive completion;
- `error()` — short low warning/error cue;
- `reveal()` — information/card/reveal transition;
- `countdown(second)` — timer emphasis where appropriate;
- `impact(level)` — cinematic accent for large scene changes.

The engine should expose `arm()`, `setEnabled(boolean)`, `isEnabled()`, and `dispose()`.

### 2. Sample-based cinematic scene audio

Real recorded/sampled audio is preferred for moments where synthetic oscillators sound artificial:

- approaching train / rail movement;
- train horn;
- station/announcement chime;
- ticket punch/stamp;
- heavy bunker door / metal lock;
- low industrial alarm texture;
- cinematic impact/whoosh;
- selected Mortal Kombat hit/arena accents.

Assets must be short, compressed, preloaded opportunistically, and have explicit fallback behavior. Missing assets may reduce atmosphere but must never break a scene.

### 3. Scene priority and ducking

Cue priority from highest to lowest:

1. Premiere media / major event audio;
2. Bunker emergency / large scene cue;
3. carriage call / train arrival / MK winner impact;
4. quiz result / registration success;
5. ordinary phone taps.

Low-priority UI cues should be suppressed or reduced while a high-priority scene cue is active. This avoids tap sounds firing over a bunker alarm or premiere countdown.

No full music-mixing subsystem is required. Simple priority suppression and fixed per-category gain levels are enough.

## Carriage Call redesign

Current carriage call duration is too short and visually/audio-wise behaves like a brief notification. It should become a deliberate room-attention scene.

### Duration

Default scene duration: **12 seconds**.

The value should remain configurable at the screen orchestration layer for tests and future tuning, but production default becomes 12,000 ms.

### Audio timeline

Approximate sequence:

- **0.0–1.2 s:** low rail rumble fades in + short station/announcement chime;
- **1.0–2.0 s:** carriage call typography and target wagons settle on screen;
- **2.5–5.0 s:** train movement grows; one cinematic horn cue appears, strong but not painfully loud;
- **5.0–9.5 s:** rail ambience continues at lower level while the message remains fully readable;
- **9.5–12.0 s:** train ambience recedes and fades with the scene.

The full call must remain readable long enough for guests to react physically and move to the announced area.

### Repeated calls

A second call arriving during an active call should queue rather than overlap audio. When the current 12-second scene ends, the next call can begin with its own train cue.

## Guest phone interaction sound

Guest phones should feel tactile but restrained.

### Global button behavior

Most meaningful buttons and tappable choices should generate a subtle `tap` or `select` cue after the first interaction has armed audio.

Do **not** add sound to passive scrolling, links that only navigate externally, or every tiny decorative interaction.

### Registration

- field/choice selection: subtle `select` where useful;
- registration submit: `confirm`;
- successful registration/ticket assignment: ticket punch or stamp + soft station chime;
- recoverable validation error: low `error` cue.

### Quiz

- selecting an answer: `select`;
- submitting/locking answer: `confirm`;
- question becomes active: restrained reveal cue;
- last countdown seconds: subtle ticks only when appropriate and not annoying;
- results reveal: cinematic reveal/impact;
- correct/positive outcome where applicable: `success`;
- invalid/retry action: `error`.

Avoid continuous ticking for the whole 30-second timer.

### Bunker

- emergency takeover: industrial alarm/low impact;
- dossier reveal: mechanical/terminal `reveal`;
- mission option tap: tactile select;
- wrong answer: low metallic error cue;
- earned fragment: cinematic success/lock cue;
- final code typing remains mostly quiet;
- wrong final code: heavy low error;
- unlocked bunker: heavy latch + bunker door opening + success swell.

### Mortal Kombat

Mortal Kombat gets its own flavor while remaining consistent with the site:

- signup/enter arena: punchy confirm;
- bracket/match reveal: arcade-cinematic impact;
- selected fighter/player: short hit/select;
- winner confirmed: stronger impact + victory accent;
- champion: largest MK audio cue.

Avoid constant menu bleeps and avoid copyrighted game audio. The palette should be original/generic arcade-cinematic sound design.

### Premiere

The premiere remains the quietest interface around the music itself.

- standby: subtle low impact/chime;
- countdown: existing countdown concept retained, refined if needed;
- play transition: no extra cue that overlaps the first beat of the track;
- pause/resume/black: restrained control feedback only;
- during actual song playback, ordinary site UI sounds on the projector should be suppressed.

## Main screen sound behavior

`/screen` sound preference remains ON by default.

The button should continue to behave as an opt-out control:

- initial visible action: `ВЫКЛЮЧИТЬ ЗВУК`;
- after disabling: `ВКЛЮЧИТЬ ЗВУК`;
- toggling off stops active generated cues and prevents new scene/UI cues;
- toggling on attempts to arm the shared audio engine again.

Browser autoplay restrictions must be represented honestly in technical readiness, but must not reverse the user-facing ON preference or block event actions.

## Asset strategy

Create a dedicated asset namespace, for example:

`public/audio/`

Suggested files/categories:

- `train/station-chime.*`
- `train/rail-approach.*`
- `train/horn.*`
- `train/rail-depart.*`
- `registration/ticket-stamp.*`
- `bunker/alarm-bed.*`
- `bunker/door-open.*`
- `bunker/lock-success.*`
- `cinematic/reveal.*`
- `cinematic/impact-soft.*`
- `mk/impact.*`
- `mk/victory.*`

Use compressed web-friendly formats supported by target browsers. Where compatibility matters, provide a conservative fallback format.

No copyrighted movie/game sound files should be embedded. Assets must be original, licensed for use, or generated specifically for this project.

## Accessibility and control

- Respect the user's explicit mute choice for the current device/session.
- Sound must never be the only way to communicate state; every important event keeps its visual equivalent.
- Avoid sudden full-scale volume spikes.
- Error sounds should be brief and non-punishing.
- Repeated high-frequency button taps should be rate-limited.
- A failed audio unlock must not produce modal blockers.

## Data and persistence

No server-side audio state is required for ordinary phone UI sound.

Projector sound preference remains device-local. Bunker/premiere owner settings that are already server-authoritative remain so.

A lightweight client preference can be stored locally so an explicit mute survives a page refresh on that device. Default for a device with no saved preference is ON.

## Integration boundaries

Existing modules should not each create unrelated long-lived `AudioContext`s after this work. The implementation should progressively route UI and generic cues through the shared engine while scene modules retain only scene-specific orchestration.

Existing audio modules to reconcile rather than duplicate:

- `src/features/screen/screenAudio.ts`
- `src/features/premiere/premiereAudio.ts`
- `src/features/bunker/bunkerAudio.ts`

Likely integration points include:

- `src/features/screen/ScreenPage.tsx`
- `src/features/screen/CarriageCallScene.tsx`
- guest registration components;
- guest quiz components;
- bunker guest/screen components;
- Mortal Kombat guest/screen components;
- premiere screen controls.

The exact file plan will be written after this design spec is approved.

## Failure handling

Audio failure is non-fatal everywhere.

If an asset cannot load:

- continue the scene visually;
- optionally fall back to a generated cue;
- do not retry aggressively in a loop.

If `AudioContext` remains suspended:

- keep the sound preference ON;
- retry arming after the next user gesture;
- technical readiness may show not armed;
- event controls remain available.

If the browser has no WebAudio support:

- sample playback may still be attempted via HTMLAudio where appropriate;
- otherwise the experience becomes visual-only without errors reaching the guest.

## Testing strategy

### Unit tests

Cover:

- global sound defaults ON;
- explicit mute suppresses generated cues;
- first interaction attempts audio arm;
- rate limiting prevents tap storms;
- priority suppression prevents low-level UI cues during major audio;
- carriage call production duration is 12 seconds;
- carriage call queue does not overlap scene audio;
- scene cue failures remain non-fatal;
- phone interaction components call the appropriate cue categories;
- projector mute silences Premiere media and site cues together.

### Integration/component tests

Verify representative flows:

- registration submit → success sound request;
- quiz select → confirm → results reveal;
- bunker wrong answer / fragment / unlock;
- MK winner/champion;
- carriage call triggers train sequence on `/screen`;
- mute prevents these cues without preventing the underlying action.

### E2E

Use Playwright with real browser interaction to verify:

- first tap unlock flow;
- mute/unmute control;
- carriage call remains visible for the longer duration;
- audio readiness does not block owner controls;
- phone interactions continue working when audio APIs are unavailable/mocked.

E2E does not need to judge subjective audio quality; it verifies orchestration, state, timing, and non-blocking behavior.

## Non-goals

- continuous background music across the website;
- per-user server-synchronized phone sound;
- a professional DAW-style mixer in admin;
- user-selectable sound themes;
- excessive vibration/haptics;
- copyrighted Mortal Kombat or film audio;
- making sound a prerequisite for any event scenario.

## Success criteria

The feature is successful when:

1. A carriage call feels like a 12-second cinematic train announcement rather than a short toast.
2. Important guest phone actions have restrained tactile sound feedback after the first interaction.
3. Registration, Quiz, Bunker, MK, Premiere, and main-screen transitions each have an appropriate sound vocabulary.
4. All sounds can be silenced from the device-level sound control.
5. Browser autoplay restrictions do not block the wedding flow.
6. Critical sound files are available locally/under controlled hosting for event reliability.
7. The site remains fully usable with audio disabled or unsupported.
