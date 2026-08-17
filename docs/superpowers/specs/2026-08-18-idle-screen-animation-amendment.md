# Amendment — Animated idle / QR screen

Date: 2026-08-18
Status: Approved concept amendment

## Goal

When no contest, premiere, tournament state, carriage announcement, or other presentation mode is active, `/screen` must show a stylish animated idle state rather than a static QR poster.

The idle screen should continuously invite arriving guests to scan the QR code and register, while visually feeling like part of the wedding identity.

## Core content

The idle screen should include:

- Liza + Viktor identity / event title
- date reference to the second day: 30 August 2026
- prominent registration QR code
- concise call to action such as `НАВЕДИТЕ КАМЕРУ НА QR` / `ПОЛУЧИТЕ СВОЙ БИЛЕТ`
- optional live count of registered guests, e.g. `УЖЕ В СОСТАВЕ: 27`
- subtle railway/ticket motif compatible with the `Поезд Виктора` mechanic

The QR code itself must stay stable, high-contrast, and easy to scan from across the room. Motion must never distort, rotate, blur, scale aggressively, or place animated elements over the QR quiet zone.

## Motion direction

Motion should be premium, restrained, and ambient rather than attention-seeking.

Preferred behavior:

- very slow drifting gradient/light field in wedding colors
- soft parallax or floating grain/paper texture
- subtle movement of thin graphic lines inspired by a railway route/ticket layout
- gentle 6–10 second text entrance/exit cycle for the call to action
- small pulse or halo near the QR area to guide attention without making the QR itself move
- occasional slow transition between two or three short invitation phrases
- no rapid cuts
- no continuous spinning elements
- no loud arcade animation
- no confetti, hearts, flowers flying across the screen, neon, or generic wedding template motion

The screen should remain comfortable to look at for long periods.

## Palette

Use the established wedding palette:

- warm ivory / beige base
- deep muted forest green
- cinnamon/brown accents
- muted wine/brick red accents
- sage/olive secondary tones

Black or near-black may appear only in small contrast regions; the normal idle state should feel warmer than the premiere mode.

## CTA rotation

Suggested rotating messages:

1. `ДОБРО ПОЖАЛОВАТЬ В СОСТАВ`
   `Наведите камеру на QR и получите свой билет`

2. `ЕЩЁ НЕ В ВАГОНЕ?`
   `Сканируйте QR — регистрация займёт меньше минуты`

3. `ВАШ БИЛЕТ УЖЕ ЖДЁТ`
   `Имя, фамилия — и вы в составе`

Copy should be editable from owner/admin settings later; MVP may seed these three variants.

## Realtime behavior

- Idle mode is the default `/screen` state whenever no explicit presentation mode is active.
- Registered guest count may update in realtime without reloading the screen.
- When owner launches a quiz, Mortal Kombat view, carriage call, premiere standby/countdown/video, or any other screen mode, idle animation yields immediately to the active mode.
- When the owner returns the screen to idle/home, the animated QR state resumes automatically.

## Performance and reliability

- Prefer CSS transforms/opacity and lightweight SVG/CSS motion.
- Avoid video backgrounds for the idle loop unless explicitly added later.
- Animation should run smoothly on a normal laptop connected to a TV/projector.
- Provide a `prefers-reduced-motion` fallback with the same visual composition but minimal movement.
- QR scanability takes priority over animation at all times.

## Owner controls

Owner/admin phone UI should include a direct command:

- `ГЛАВНЫЙ ЭКРАН / QR`

This command returns the laptop/projector to the animated registration idle state from any other module.

## Acceptance criteria

1. With no activity active, `/screen` shows an animated, branded QR registration screen.
2. QR remains easily scannable during all animation phases.
3. Motion uses the wedding palette and feels restrained/premium.
4. CTA text subtly changes over time without distracting from conversation in the room.
5. Registered guest count can update live if enabled.
6. Any active module can replace idle mode immediately and owner can return to idle from phone.
7. Idle animation resumes correctly after refresh/reconnect.
