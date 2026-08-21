# Wedding + Game Visual Redesign

**Date:** 2026-08-20  
**Status:** Approved direction; implementation follows after final spec confirmation.  
**Project:** Existing `liza-viktor.site` React/Supabase application.

## Goal

Redesign the existing wedding site and its game surfaces without creating a second application, replacing the database, or duplicating guest, carriage, realtime, TV, admin, and reset entities.

The redesign has four related but visually distinct surfaces:

1. Wedding home and Guest Hub — editorial wedding site based on reference 03.
2. Registration, invitation, ticket, and idle TV — vintage railway ephemera based on reference 02.
3. Bunker player/admin/TV — black-and-ivory restricted-object archive based on reference 01.
4. Mortal Kombat tournament — original stone arena and archival game-history composition based on reference 04, without copyrighted fighters, logos, dialogue, or game artwork.

## Shared Architecture

- Keep one React application and the existing router.
- `/` becomes the wedding home page.
- `/join` remains the fast QR registration and ticket flow.
- Existing guest identity, registration restore, carriage assignment, realtime subscriptions, TV screen guard, admin actions, and reset behavior remain authoritative.
- The new Bunker runtime and player dashboard are integrated into the existing Guest Hub rather than exposed as a second app.
- Presentation themes are isolated with route/surface theme roots so wedding CSS cannot leak into Bunker or Mortal Kombat.
- Dynamic game UI always renders from active wagon/session data; visual layout must support 2–5 wagons.

## Wedding Home

Reference: uploaded image 03.

### Visual language

- Warm ivory paper, graphite typography, taupe secondary surfaces, dark editorial program bands.
- Large high-contrast serif headlines with restrained sans-serif metadata.
- Arched photography, thin rules, small jewelry-like marks, generous whitespace.
- No SaaS cards, rounded dashboard blocks, loud gradients, or floating glass effects.

### Page structure

1. Compact navigation.
2. Hero with names/date and an arched couple photograph.
3. Horizontal countdown.
4. Couple story.
5. Dark schedule band.
6. Venue and dress code.
7. Editorial gallery.
8. Registration invitation linking to `/join`.
9. Monogram footer.

Real couple photographs must be edited from supplied originals; faces must not be invented. Until originals are supplied, photograph-dependent slots are implemented structurally but are not filled with fake people.

## Registration And Railway Ticket

Reference: uploaded image 02.

- Preserve all current form, restore, duplicate-warning, ticket reveal, and recovery behavior.
- Rebuild presentation as a horizontal railway ticket on desktop and a vertical boarding pass on mobile.
- Palette: cream paper, blue-gray stub, dark railway blue ink.
- Use double rules, ornamental corners, perforation, real QR, dynamic ticket number, real guest name, and dynamic wagon.
- Generate a text-free locomotive engraving, Tyumen skyline engraving, paper texture, and railway seal.
- Never bake dynamic text or QR into raster assets.
- Replace hardcoded “five carriages” copy with neutral/dynamic session wording.

## Bunker

Reference: uploaded image 01.

### Visual language

- Restricted transport-object archive rather than cyberpunk.
- Deep black/graphite, ivory type, muted steel, red only for alarms.
- Editorial asymmetric grids, thin index rules, monochrome technical photography, very restrained grain.
- Display serif for large story headlines; clean sans for readable body; monospaced numerals/labels.

### Player

- Integrate the existing `BunkerPlayerDashboard` into the registered guest flow.
- Preserve seven required areas: wagon, character, passengers, inventory, archive, state, current mission.
- Use a sticky mobile bottom navigation with 44–48 px targets.
- Show one dominant current action; irreversible decisions retain confirmation.
- Late-registration notice stays visible but does not block the current mission.

### Admin

- Reuse existing server commands and permission gates.
- Recompose as a dispatcher console with global state, guest/wagon counts, connected TVs, current stage, and one clear primary launch action.
- Dangerous actions live in a separate confirmed zone.

### TV

- One headline, one timer, and only the state necessary for the room.
- Use adaptive 2/3/4/5-wagon layouts rather than a fixed five-column grid.
- Provide ≥5% TV safe area and test 1366×768, 1920×1080, and 4K proportions.
- Restore current scene and server-derived timer after reload/reconnect.

### Motion

- 600–900 ms blackout, one short sync tear, then a masked title reveal.
- Mission changes use a photographic vertical wipe resembling a train window passing.
- No permanent glitch loops.
- Final door opening uses real generated imagery, pressure light, and restrained motion.
- All decorative motion respects `prefers-reduced-motion`.

## Mortal Kombat Tournament

Reference: uploaded image 04.

- Preserve the existing tournament, registration, bracket, admin, realtime, fight, milestone, and champion logic.
- Build an original stone wedding arena; no official dragon emblem, character likeness, game art, music, or voice lines.
- Use two original decorative fighters and a central wedding/railway arcade altar.
- Real guest names and bracket seeds remain the primary content; do not generate fake fighter portraits for guests.
- Mobile bracket must avoid fixed four-column overflow and expose clear horizontal progress.

## Generated Image Assets

Use the built-in Canvas/ImageGen path. All assets are generated without text and saved into the project before being referenced.

### Wedding/ticket

- locomotive engraving, transparent;
- Tyumen skyline engraving, transparent;
- railway monogram seal;
- subtle paper texture;
- wide cinematic train-arrival plate.

### Bunker

- tunnel/route relief in desktop and mobile crops;
- train entering a tunnel;
- brutalist bunker exterior;
- steel bunker door in closed/open-light variants;
- six Mission 02 evidence images;
- master tunnel map suitable for 2–5 fragment crops;
- BK-17/card/document/archive stills;
- subtle black-paper/steel/glass materials.

### Mortal Kombat

- original arena desktop/mobile;
- original left/right fighters on transparent backgrounds;
- wedding/railway arcade altar;
- champion hall;
- subtle stone-paper texture.

## Audio — Free-Only Strategy

- No paid sound generator, paid library, or subscription is required.
- Replace oscillator-only scene audio with local recorded/sample assets carrying a clear CC0 or compatible royalty-free licence.
- Keep oscillator tones only as an inaudible/quiet emergency fallback when samples fail.
- Store production audio locally; TV playback must not depend on external URLs during the event.
- Record asset source, author, licence, and download date in `public/audio/ATTRIBUTION.md` even when attribution is not required.
- If a required sound cannot be sourced cleanly, provide the user with an exact search/generation prompt and file requirements instead of using an unclear asset.

### Scene design

- Arrival: platform air → station chime → irregular rail approach → distant two-tone horn → pass-by → brake metal/air → ticket stamp.
- Bunker launch: power cut → relay → emergency brake → pressure/impact → short non-periodic alarm → quiet 45–60 second tension ambience.
- Terminal: physical key, relay, scan, confirmation/error.
- Bunker opening: locks → pressure release → heavy door movement → short harmonic resolve.
- Tournament: short metal/gong accents only; no beat loop and no copied Mortal Kombat audio.

### Synchronization

- One shared audio context/master bus.
- Scene one-shots are scheduled from server timestamps, not realtime arrival time.
- Reconnecting TVs join ambience at the correct offset and do not replay an old horn/impact.
- Preload, mute, volume, priority, ducking, and fallbacks remain testable.

## Accessibility And Device Requirements

- Body text ≥16 px on mobile; technical labels ≥12 px where practical.
- Touch targets ≥44 px and visible `:focus-visible` styles.
- Do not rely on color or audio alone to convey state.
- Preserve readable contrast and visual equivalents for every sound cue.
- Test widths 320, 390, 768, 1440 and TV dimensions.
- Test long real names, 2–5 wagons, offline/reconnect, reload, reduced motion, and muted sound.

## Implementation Order

1. Theme isolation, tokens, fonts, and global cascade cleanup.
2. Wedding home and responsive editorial shell.
3. Registration, ticket, Guest Hub, and registration TV.
4. Bunker player integration, admin, and TV presentation.
5. Mortal Kombat guest, bracket, fight, and champion presentation.
6. Generated asset placement and responsive crops.
7. Free local sample audio engine and scene timelines.
8. Functional regression, visual comparison, accessibility, mobile, desktop, TV, reload, realtime, and production build verification.

## Non-Goals

- No second website or application.
- No replacement of the existing database or guest identity.
- No fictional guest names.
- No redesign-driven changes to mission rules.
- No copyrighted Mortal Kombat art, music, characters, logos, or dialogue.
- No paid asset dependency.
- No production deployment or database migration application without explicit authorization.
