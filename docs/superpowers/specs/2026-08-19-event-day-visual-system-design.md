# Event-Day Visual System Design

## Goal

Create a coherent, premium visual system for the wedding live platform while preserving all existing event logic, scene priority, routes, synchronization, registration, quiz, premiere, Mortal Kombat, Bunker, reset behavior, and multi-screen operation.

The product should feel like one curated wedding experience with three intentionally distinct visual worlds:

1. **Wedding Editorial + Railway** — the default visual language for registration, guest ticket, idle TV, train arrival, quiz, couple reveals, Final Five, and neutral event UI.
2. **Mortal Kombat Poster / Artbook** — a dramatic game chapter with black, warm gold, arena framing, fighter-card grids, and editorial game-history energy.
3. **Bunker Monochrome Archive** — a severe black-and-ivory editorial chapter inspired by archival observatories, architectural publications, secret bulletins, technical diagrams, and scientific indexes.

## Non-negotiable Product Constraints

- Do not alter the live scene priority hierarchy:
  1. Bunker
  2. Premiere
  3. Mortal Kombat on shared TV only when explicitly enabled by owner
  4. Quiz / reveals
  5. carriage call / train arrival
  6. idle QR
- Do not add a second screen state machine or independent fixed overlay that can overtake the current hierarchy.
- Keep `/screen` free of owner mutation controls.
- Keep all QR codes large enough for Full HD TV viewing from a real room.
- Preserve `prefers-reduced-motion` fallbacks.
- Preserve mobile admin usability at 390 px and main presentation at 1920×1080.
- Preserve all existing copy that is part of the event scenario unless a copy change is explicitly described below.
- Do not use copyrighted Mortal Kombat artwork or copied wedding reference artwork as production assets. All illustrations, icons, textures, and decorative elements must be original.

---

# 1. Wedding Editorial + Railway World

## Visual Intent

The default product should feel like a refined wedding editorial with railway identity rather than a themed railway game.

Target balance:
- approximately **70% elegant wedding editorial**
- approximately **30% railway ephemera**

Railway cues should appear through structure and details rather than novelty decoration: ticket borders, perforation, route lines, carriage numbers, stamps, monograms, small locomotive engravings, luggage marks, directional arrows, destination labels, subtle track geometry, and detachable-stub compositions.

## Palette

Base colors:
- Paper ivory: `#F3EEE5`
- Soft cream: `#E9DFD0`
- Warm mist: `#D9D2C7`
- Graphite: `#252724`
- Deep forest: `#31483A`
- Dusty blue-grey: `#9BA9B4`
- Muted brass: `#A58C5B`
- Soft cinnamon: `#9A6348`

Rules:
- Wedding-facing pages should be mostly light.
- Dark backgrounds are reserved for narrative transitions, Premiere, MK, and Bunker.
- Carriage colors may survive as subtle accents rather than full-panel backgrounds.

## Typography

Use the current system font stack for small interface text and introduce a stronger editorial serif stack for display typography using web-safe / already available fonts only unless a future font-loading task is explicitly approved.

Display characteristics:
- high contrast serif
- generous uppercase tracking for labels
- large names and carriage numbers
- tight optical spacing for hero headlines
- small editorial metadata around borders

Do not depend on a proprietary downloadable font file.

## Decorative Grammar

Reusable motifs:
- `✦` star separators
- thin double rules
- miniature route arrows
- perforated detachable edges
- rectangular railway ticket corners
- circular date stamps
- small `L × V` monogram
- `LV-xxx` ticket numbering
- carriage mark / visual symbol
- tiny original locomotive line illustration
- small wedding line icons: rings, glass, flower, luggage, clock, carriage, route pin

Decoration should never reduce legibility.

---

# 2. Idle TV / Registration Screen

## Composition

The screen should read as an oversized collectible railway wedding ticket across the television.

Left/main body:
- `ЛИЗА × ВИКТОР`
- large editorial headline inviting guests to receive their ticket
- short welcome line
- route motif
- subtle original railway illustration or line engraving

Right/detachable stub:
- large QR code
- event date
- `TRAIN No. LV-830` or equivalent event identifier
- scan instruction
- decorative perforation between body and stub

The QR remains the most practically important item on the screen.

## Motion

Very restrained:
- slow paper-light drift
- subtle route-line travel
- barely perceptible grain/parallax

No bouncing UI and no continuous distracting motion near the QR code.

---

# 3. Guest Mobile Ticket

## Composition

The success state should become a real collectible ticket rather than a generic success card.

Required information hierarchy:
- railway/event identity
- passenger name
- carriage number / label
- carriage visual mark
- ticket id `LV-xxx`
- event date
- compact route / validity metadata

Visual treatment:
- ivory stock
- engraved double border
- one detachable-looking edge
- subtle carriage accent
- original locomotive or route illustration
- stamp / serial number details

The ticket must remain functional HTML, not a flattened image.

---

# 4. Train Arrival Scene

## Intent

Keep the train reveal cinematic, but move away from a generic technical motion graphic toward an editorial illustrated arrival.

Visual changes:
- richer paper/ink depth
- more elegant train silhouette and railway engraving language
- soft steam and headlight bloom
- large passenger name as editorial hero typography
- carriage assignment presented like a railway platform announcement
- less neon / digital feeling

The locomotive, passenger consist, track, steam, and carriage assignment must remain recognizable and testable.

---

# 5. Quiz / Couple Reveal / Final Five

## Intent

These remain inside the Wedding Editorial world.

Use:
- oversized serif questions
- editorial answer cards
- thin rules and stamps
- subtle couple imagery when available
- restrained wedding line icons
- carriage symbols as small accent markers

Avoid turning quiz UI into game-show neon graphics.

---

# 6. Mortal Kombat World

## Visual Intent

MK must feel like an intentional hard cut from the wedding visual world: a premium editorial game poster / artbook chapter.

Inspiration characteristics:
- black / near-black field
- warm aged gold typography
- large condensed display headings
- dark stone / arena ambience
- central `VS` confrontation
- fighter-card matrix around the composition
- arcade / tournament plaque details
- framed character portraits or original silhouette treatment

## Palette

- Black: `#0D0D0D`
- Warm black: `#171514`
- Antique gold: `#B39A56`
- Light gold: `#D2BD78`
- Deep oxblood: `#5D211C`
- Stone: `#6B6256`

## Typography

Large, aggressive condensed headlines with editorial spacing. Use available fonts only; achieve energy with CSS sizing, width, tracking, borders, and layout rather than importing protected game fonts.

## Screen Architecture

### Current Match
- fighter A left
- fighter B right
- large central `VS`
- round / bracket metadata above or below
- cinematic but readable at TV distance

### Tournament Grid
- fighter cards should read like a poster wall / roster
- eliminated states visibly quieter
- winner state receives gold treatment
- active match uses stronger gold/oxblood frame

### Dedicated MK Screen
- can be visually richer than the shared `/screen`, but must use the same data and owner-controlled presentation behavior

## Asset Rules

Do not ship official Mortal Kombat logos, screenshots, character artwork, or copied UI. Use original symbolic fighter cards, silhouettes, initials, guest names, decorative arena shapes, and original textures.

---

# 7. Bunker World

## Visual Intent

The Bunker is not a red sci-fi alarm interface. It should feel like an intercepted emergency railway bulletin from an archival research system: monochrome, severe, editorial, scientific, and unsettling.

Reference characteristics:
- black field
- ivory/off-white typography
- technical grid
- archival image zones
- small scientific labels and numbering
- unusual oversized headline typography
- quiet but ominous motion
- photographic/print grain feeling

## Palette

- Archive black: `#101010`
- Paper white: `#E9E5DB`
- Grey: `#9E9A91`
- Muted warning tint only when needed: `#7A5148`

Red should not dominate.

## Emergency Screen Composition

Header:
- small system id / route metadata
- subtle status mark
- `ЭКСТРЕННОЕ СООБЩЕНИЕ`

Main body:
- `ПОЕЗД ИЗМЕНИЛ МАРШРУТ.`
- large destination word `БУНКЕР`
- `ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА`
- enormous `30:00` countdown or arrival state

Secondary visual layer:
- technical grid / contour lines
- archival route diagram
- optional original monochrome bunker/terrain illustration
- small coordinates / system labels used as atmosphere only

Footer:
- keep operator guidance
- show route status / point reached state

## Motion and Sound

Motion:
- slow scan or print-registration drift
- tiny coordinate movement
- subtle noise / line shimmer
- timer remains stable and legible

Sound behavior stays exactly as currently implemented. The visual redesign must not change sound arming, countdown synchronization, arrival hold, or owner STOP semantics.

---

# 8. Premiere

Premiere remains cinematic and dark, but should visually bridge Wedding Editorial and the protected video mode.

Before video:
- elegant black field
- ivory wedding typography
- very restrained railway metadata
- countdown as editorial numerals rather than generic app UI

During video:
- video remains dominant
- avoid decorative overlays that interfere with playback

Bunker must still unmount/override Premiere according to existing priority.

---

# 9. Icons and Illustration Strategy

Use a small original icon/illustration library rather than many unrelated decorations.

Initial set:
- locomotive
- railway carriage
- ticket
- luggage
- clock
- route arrow / route pin
- rings
- champagne glass
- flower
- star / sparkle
- bunker contour / archive marker
- generic fighter emblem / crossed brackets for MK

Preferred implementation:
- lightweight inline SVG components or CSS line art for icons
- original locally stored illustration assets only when a richer image is justified
- no external CDN dependency for decorative assets

If photographs of Liza and Viktor are later provided, they may be used in arch/oval editorial frames on wedding-facing screens without making the live TV layouts dependent on those photos.

---

# 10. Texture and Surface Rules

Wedding:
- paper grain
- subtle vignette
- soft photographic warmth

MK:
- stone / print poster texture
- restrained distressing
- strong frame contrast

Bunker:
- monochrome grain
- scientific linework
- archival scan feeling

Textures must be CSS/lightweight assets and must not create performance problems on TV browsers.

---

# 11. Responsive and TV Rules

TV presentation:
- primary target 1920×1080
- keep core content inside safe margins
- never place essential copy too close to edges
- QR remains readable from room distance
- timers use tabular numerals

Mobile:
- guest ticket should preserve the ticket concept at narrow width
- decorative details may collapse before functional content
- no horizontal overflow

Admin:
- visual changes should not reduce touch targets or owner readability
- the rehearsal readiness dashboard remains functional and compact

---

# 12. Implementation Boundaries

This visual redesign is presentation-first.

Allowed:
- component markup changes that only support layout/decorative structure
- CSS additions and refactoring for visual presentation
- original inline SVG/icon components
- original local decorative imagery
- test updates that assert preserved functional anchors and required visual structure

Not allowed without a separate approved feature design:
- new game mechanics
- changes to carriage allocation
- changes to reset semantics
- changes to couple-answer data model
- changes to screen authority / priority
- changes to owner permissions
- changes to Bunker timer logic
- changes to Premiere sync logic
- changes to MK bracket logic

---

# 13. Rollout Order

Visual work should ship in independent, testable slices:

1. shared wedding visual tokens + idle TV + guest ticket
2. train arrival + quiz/reveal visual language
3. Mortal Kombat visual system
4. Bunker visual system
5. Premiere bridge styling
6. final cross-screen polish + responsive verification

Each slice must preserve existing unit tests and the full multi-client E2E event flow before merge.

---

# Acceptance Criteria

The redesign is accepted when:

- the default wedding experience feels light, editorial, romantic, and premium;
- railway identity is clear but never overwhelms the wedding identity;
- the idle TV reads visually as a luxury railway wedding ticket while retaining a large functional QR;
- the mobile guest ticket feels collectible and still displays all required live data;
- train arrival remains cinematic and clearly communicates passenger + carriage;
- MK feels like a distinct premium game-poster/artbook chapter without copyrighted production artwork;
- Bunker feels like a monochrome archival emergency system, not a red sci-fi HUD;
- Premiere remains visually elegant and protected;
- all existing scene priority, synchronization, security, reset, late-guest, and owner-control behavior remains unchanged;
- `prefers-reduced-motion`, 390 px admin/mobile behavior, and 1920×1080 TV behavior remain verified;
- full unit/build/E2E test suites pass after each merged visual slice.

