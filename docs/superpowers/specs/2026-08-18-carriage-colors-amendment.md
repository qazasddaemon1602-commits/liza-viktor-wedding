# Amendment — Цветовая навигация вагонов

Date: 2026-08-18
Status: Approved concept amendment

## Goal

Give each carriage/team a stable color identity so guests can recognize their group quickly during the second-day event on 2026-08-30.

Color is a navigation aid, not the only identifier. Every carriage must always keep its number/label visible as well.

## Principle

- `Вагон = команда` remains unchanged.
- Each carriage has one permanent accent color for the whole event.
- The color appears consistently on the virtual ticket, guest hub, calls/announcements, team score/status, Mortal Kombat invitations, admin lists and projector screens.
- Do not use bright rainbow/team-game colors. All five colors must belong to the wedding's restrained green / beige / cinnamon / muted-red palette.
- Do not rely on color alone: always pair it with `ВАГОН №N` and a small stable mark/pattern for accessibility and quick recognition.

## Initial 5-carriage palette

Recommended starting palette:

1. `ВАГОН №1 — ЛЕСНОЙ` — deep forest green, approx. `#31483A`
2. `ВАГОН №2 — КОРИЧНЫЙ` — warm cinnamon brown, approx. `#9A6348`
3. `ВАГОН №3 — ВИННЫЙ` — muted wine / brick red, approx. `#7E3F3C`
4. `ВАГОН №4 — ШАЛФЕЙ` — muted sage / olive green, approx. `#78806A`
5. `ВАГОН №5 — ПЕСОЧНЫЙ` — warm taupe / sand, approx. `#B49B7E`

These are working UI tokens, not hard final brand values. They can be tuned slightly during implementation to pass contrast checks and match the final visual system.

## Usage

### Virtual ticket

The ticket stays mostly ivory/beige and premium. The carriage color appears as a restrained accent: side stripe, punched-number block, small seal, carriage number, or thin frame. Do not flood the entire ticket background with saturated color.

### Guest hub

Guest always sees a compact persistent badge such as:

`● ВАГОН №3`

The dot/accent uses the carriage color, while the text remains high-contrast.

### Announcements

When owner/admin calls a carriage, the projector and targeted phones use that carriage's accent color around the message while keeping the main background and typography within the wedding visual system.

For multi-carriage calls, show each targeted carriage as a separate labeled colored badge rather than mixing colors into a gradient.

### Admin

Registered-guest lists and carriage counts use the same stable color tokens. Owner can recognize groups at a glance, but all actions still display numbers/names.

## Data model

Add to `carriages`:

- `color_token` or `accent_hex`
- optional `visual_mark` for future pattern/icon differentiation

Carriage color is owner-editable before the event. Changing a color updates every client using that carriage identity.

## Accessibility

- Never communicate carriage identity by color alone.
- Always show carriage number/label.
- Use high-contrast text independent of accent color.
- For red/green distinction, include number and/or visual mark so color-vision deficiency does not cause confusion.

## Acceptance criteria

1. Every carriage/team has one stable recognizable color.
2. The five colors feel like one wedding palette rather than five unrelated team colors.
3. A guest can identify their carriage quickly from ticket, hub and projector announcement.
4. Carriage identity remains understandable in grayscale or with color-vision deficiency because number/label is always present.
5. Owner/admin sees the same color mapping everywhere in the system.
