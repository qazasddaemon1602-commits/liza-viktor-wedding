# Amendment — анимация поезда при регистрации гостя

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Turn each successful guest registration into a small celebratory moment on the shared idle/QR screen while keeping the QR continuously scannable and the overall wedding visual language restrained.

## Trigger

After a guest successfully registers and receives a carriage/team assignment, the shared `/screen` idle mode receives a realtime registration event.

The animation should appear only when the shared screen is currently in idle/QR mode or another explicitly compatible ambient state. It must not interrupt an active quiz, Mortal Kombat match, premiere countdown/video playback, or another owner-controlled screen state.

## Visual behavior

- Duration target: approximately 3–4 seconds.
- A refined stylized train/railway composition enters the screen, moves through a short controlled animation, and exits.
- The train should feel editorial and premium, not cartoonish and not like a Russian Railways clone.
- The train may use subtle carriage windows, linework, route marks, motion blur, and paper/ticket references.
- The assigned carriage/team color is used as the accent for the guest's carriage area.
- The permanent idle-screen QR code remains stationary, readable, and unobstructed during the entire animation.
- Avoid confetti, neon, excessive bouncing, or loud game-like effects.

Suggested copy inside/alongside the animated train:

`НОВЫЙ ПАССАЖИР`

`ИВАН П.  →  ВАГОН №3`

Optional secondary line:

`ДОБРО ПОЖАЛОВАТЬ В СОСТАВ`

For public display, default to first name + surname initial rather than full personal details. Owner/admin still sees the full registered name in `/admin`.

## Sound

A short restrained railway sound accompanies the animation:

- preferred: soft train whistle / departure signal / polished station chime;
- low volume relative to music and conversation;
- duration approximately 0.5–1.5 seconds;
- no harsh horn blast;
- no repeated sound loop.

The laptop `/screen` must already have audio permission armed by the owner's initial local interaction. If audio is unavailable, the visual animation must still work without error.

Owner/admin should have a simple setting to mute/unmute registration sounds without disabling the visual animation.

## Multiple rapid registrations

If several guests register within a short interval:

- do not stack multiple trains on top of each other;
- queue registration animations;
- play them sequentially;
- optionally collapse a very large burst into one summary animation after a threshold, e.g. `+4 НОВЫХ ПАССАЖИРА`, while still processing all registrations normally in admin.

## Admin behavior

The existing owner-only realtime notification remains separate from the public screen animation.

Admin notification example:

`НОВЫЙ ПАССАЖИР — Иван Петров · Вагон №3`

The admin can open the guest record, correct data, move carriage, or delete a duplicate. Deleting a duplicate later does not need to replay or reverse the public train animation.

## Realtime and reliability

- Registration is committed first.
- Carriage assignment is persisted first.
- Only then is the screen animation event emitted/derived.
- If the screen reconnects after missing the event, do not replay stale registration animations from long ago.
- The animation is a presentation effect, never part of the authoritative registration transaction.

## Accessibility and fallback

- Respect `prefers-reduced-motion`: replace the moving train with a short elegant fade/slide notification while preserving the same information.
- Color is not the only carriage identifier; always show the carriage number/text.
- Sound must be optional and nonessential.

## Acceptance criteria

1. A successful guest registration can trigger a 3–4 second train arrival animation on the shared idle/QR screen.
2. The animation shows who registered and which carriage/team they received.
3. The assigned carriage color is visible but the number remains the primary identifier.
4. The QR remains stationary and scannable during the animation.
5. A subtle low-volume railway signal plays when sound is enabled.
6. Active competitions or premiere playback are never interrupted by registration animations.
7. Rapid registrations queue cleanly instead of overlapping.
8. The owner can mute registration sounds independently from the visual effect.
