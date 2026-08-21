# Wedding + Game Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the existing wedding, railway-ticket, Bunker, and tournament surfaces while preserving the current guest, game, realtime, TV, admin, and reset architecture.

**Architecture:** Keep the single React/Supabase application and isolate each visual language behind a route-level theme root. Generated imagery and licensed audio are local presentation assets; all authoritative state remains in the existing services and database. Deliver each surface through test-first, independently reviewable tasks, then run a combined visual and functional regression pass.

**Tech Stack:** React 19, TypeScript 7, React Router 7, Supabase, Vitest, Testing Library, Playwright, CSS, built-in Canvas/ImageGen.

**Spec:** `docs/superpowers/specs/2026-08-20-wedding-game-visual-redesign.md`

## Global Constraints

- Do not create a second application or duplicate guest, wagon, game session, realtime, TV, admin, or reset entities.
- Do not change mission rules as part of the visual work.
- Dynamic game presentation must support 2–5 active wagons and long real guest names.
- Do not apply production migrations or deploy without explicit authorization.
- Use real registered guest names; never generate fictional guest portraits or names.
- Use no copyrighted Mortal Kombat characters, emblems, dialogue, music, or game artwork.
- Use only local audio with a documented CC0 or compatible royalty-free licence.
- Respect reduced motion, muted audio, 44 px minimum touch targets, and TV safe areas.
- Preserve current registration recovery, reload/reconnect, realtime subscriptions, permissions, and reset boundaries.

---

## File Map

- `src/features/wedding/WeddingHomePage.tsx`: new public editorial home.
- `src/features/wedding/WeddingHomePage.test.tsx`: route and primary CTA coverage.
- `src/features/registration/*`, `src/features/guest/*`: presentation-only ticket and Guest Hub changes.
- `src/features/bunker/BunkerPlayerDashboard.tsx`: existing state-driven player surface, integrated into Guest Hub.
- `src/features/admin/bunker/*`: existing protected commands presented as dispatcher console.
- `src/features/bunker/BunkerScreenGuard.tsx`, `src/features/bunker/BunkerEmergencyScene.tsx`, `src/features/bunker/BunkerQuestScene.tsx`: TV presentation and reconnect-safe scene restoration.
- `src/features/mortalKombat/*`: tournament presentation only; existing services remain authoritative.
- `src/lib/sampleAudio.ts`: decoded-buffer cache, playback, priorities, ducking, and timestamp offsets.
- `src/lib/audioManifest.ts`: typed local cue manifest and licence metadata references.
- `src/styles/theme-tokens.css`: shared font, spacing, focus, and motion tokens.
- `src/styles/wedding-home.css`, `src/styles/wedding-registration.css`, `src/styles/bunker.css`, `src/styles/mortal-kombat.css`: isolated surface styles.
- `public/images/{wedding,ticket,bunker,tournament}`: generated raster assets.
- `public/audio/*`: free licensed production audio.
- `public/audio/ATTRIBUTION.md`: source, author, licence, source URL, and download date.
- `design-qa.md`: reference-versus-build visual QA record.

---

### Task 1: Theme isolation and route foundation

**Files:**
- Create: `src/styles/theme-tokens.css`
- Modify: `src/main.tsx`
- Modify: `src/app/routes.tsx`
- Test: `src/app/routes.test.ts`
- Test: `src/app/routes.meta.test.ts`

**Interfaces:**
- Produces: route `/` rendering `WeddingHomePage`; theme roots `.theme-wedding`, `.theme-ticket`, `.theme-bunker`, `.theme-tournament`.
- Preserves: `/join`, `/screen`, `/admin`, `/mortal-kombat`, and all current redirects except `/`.

- [ ] **Step 1: Write the failing route test** asserting `/` renders an element with accessible heading `Лиза и Виктор` and that `/join` still renders registration.
- [ ] **Step 2: Run `npm test -- src/app/routes.test.ts src/app/routes.meta.test.ts`** and confirm the home assertion fails because `/` redirects.
- [ ] **Step 3: Add `WeddingHomePage` import and replace only the `/` redirect**, then add neutral font, focus, spacing, reduced-motion, and theme-root tokens without changing service code.
- [ ] **Step 4: Run the two route test files and `npm run typecheck`**; both must pass.

### Task 2: Editorial wedding home

**Files:**
- Create: `src/features/wedding/WeddingHomePage.tsx`
- Create: `src/features/wedding/WeddingHomePage.test.tsx`
- Create: `src/styles/wedding-home.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `/join` as the primary registration destination.
- Produces: semantic sections with IDs `story`, `schedule`, `venue`, `gallery`, `rsvp` and a primary `Зарегистрироваться` link.

- [ ] **Step 1: Write failing component tests** for the names/date, five semantic sections, navigation links, and `/join` CTA.
- [ ] **Step 2: Run `npm test -- src/features/wedding/WeddingHomePage.test.tsx`** and confirm failure because the component does not exist.
- [ ] **Step 3: Implement the semantic page shell** using structural photo frames with accessible neutral labels only where real couple photographs are not yet available; do not invent faces.
- [ ] **Step 4: Implement responsive editorial CSS** matching reference 03: ivory paper, graphite type, arched frames, dark schedule band, no SaaS cards, and usable widths 320/390/768/1440.
- [ ] **Step 5: Run the component tests and `npm run build`**; both must pass.

### Task 3: Railway registration, ticket, and idle TV

**Files:**
- Modify: `src/features/registration/RegistrationPage.tsx`
- Modify: `src/features/registration/VirtualTicket.tsx`
- Modify: `src/features/guest/VirtualTicket.tsx`
- Modify: `src/features/screen/IdleRegistrationScreen.tsx`
- Modify: `src/styles/wedding-registration.css`
- Modify: `src/styles/wedding-editorial.css`
- Test: `src/features/registration/RegistrationPage.test.tsx`
- Test: `src/features/guest/VirtualTicket.test.tsx`
- Test: `src/features/screen/IdleRegistrationScreen.test.tsx`

**Interfaces:**
- Consumes: current registration model, QR link, ticket number, guest name, and wagon assignment.
- Produces: desktop horizontal ticket and mobile vertical boarding pass without baking dynamic data into imagery.

- [ ] **Step 1: Add failing tests** proving dynamic guest name, ticket number, QR/join URL, and wagon copy remain in the DOM and no fixed `ПЯТЬ ВАГОНОВ` copy is rendered.
- [ ] **Step 2: Run the three focused test files** and confirm the new fixed-copy assertion fails where applicable.
- [ ] **Step 3: Recompose markup into ticket body and perforated stub** while preserving submit, recovery, duplicate warning, and ticket reveal handlers unchanged.
- [ ] **Step 4: Implement responsive ticket styling** with cream paper, blue-gray stub, railway-blue ink, double rules, 44 px controls, and visible focus.
- [ ] **Step 5: Run focused tests plus `npm run build`** and confirm pass.

### Task 4: Generate and integrate wedding/ticket image assets

**Files:**
- Create: `public/images/ticket/locomotive-engraving.png`
- Create: `public/images/ticket/tyumen-skyline-engraving.png`
- Create: `public/images/ticket/railway-seal.png`
- Create: `public/images/ticket/paper-texture.png`
- Create: `public/images/wedding/train-arrival-wide.png`
- Modify: ticket, idle TV, and train-arrival CSS consumers.

**Interfaces:**
- Produces: text-free assets with stable local URLs under `/images/...`.

- [ ] **Step 1: Measure final desktop/mobile slots** and record required crop/aspect ratios in the asset prompts.
- [ ] **Step 2: Generate each distinct image through one built-in Canvas/ImageGen call** using uploaded references 02/03 only as style/composition references.
- [ ] **Step 3: Inspect every output** for text, logos, watermarks, broken geometry, wrong palette, and poor crop; regenerate only the failed asset with one targeted change.
- [ ] **Step 4: Copy selected outputs into `public/images/...`** with the exact filenames above and reference them through CSS or `<img>` elements with useful alt text where semantic.
- [ ] **Step 5: Run affected component tests and `npm run build`**.

### Task 5: Integrate Bunker player dashboard into the existing guest flow

**Files:**
- Modify: `src/features/guest/GuestHub.tsx`
- Modify: `src/features/bunker/BunkerPlayerDashboard.tsx`
- Modify: `src/features/bunker/useGuestBunkerLiveState.ts`
- Create: `src/styles/bunker-player.css`
- Modify: `src/main.tsx`
- Test: `src/features/guest/GuestHub.test.tsx`
- Test: `src/features/bunker/BunkerPlayerDashboard.test.tsx`

**Interfaces:**
- Consumes: existing guest identity and `useGuestBunkerLiveState` runtime snapshot.
- Produces: seven sections `МОЙ ВАГОН`, `ПЕРСОНАЖ`, `ПАССАЖИРЫ`, `ИНВЕНТАРЬ`, `АРХИВ`, `СОСТОЯНИЕ`, `ТЕКУЩЕЕ ЗАДАНИЕ` and late-registration notice.

- [ ] **Step 1: Add failing tests** for active-session integration, seven-section navigation, real guest name, late-registration notice, and excluded-character participation copy.
- [ ] **Step 2: Run the two focused test files** and confirm the integration assertion fails.
- [ ] **Step 3: Mount the existing dashboard inside `GuestHub` only when an active Bunker runtime exists**, retaining the normal wedding Hub otherwise.
- [ ] **Step 4: Implement sticky mobile navigation, one dominant CTA, 44–48 px targets, long-name wrapping, and explicit loading/offline states.**
- [ ] **Step 5: Run focused tests, `npm run typecheck`, and `npm run build`.**

### Task 6: Bunker admin dispatcher presentation

**Files:**
- Modify: `src/features/admin/bunker/AdminBunkerControl.tsx`
- Modify: `src/features/admin/bunker/AdminBunkerDock.tsx`
- Create: `src/styles/admin-bunker.css`
- Modify: `src/main.tsx`
- Test: `src/features/admin/bunker/AdminBunkerControl.test.tsx`

**Interfaces:**
- Consumes: existing permission gates and server commands.
- Produces: dispatcher summary, recommended dynamic wagon distribution, connected-TV list, current stage, primary stage action, and confirmed danger zone.

- [ ] **Step 1: Add failing tests** for 2–5 wagon summary rendering, recommendation acceptance, manual wagon-count warning, and confirmation for reset/emergency actions.
- [ ] **Step 2: Run the focused admin test** and verify new assertions fail.
- [ ] **Step 3: Recompose only the view hierarchy**; do not replace RPC/service calls or relax owner permissions.
- [ ] **Step 4: Add dispatcher-console styling** with readable mobile cards rather than small tables and clear online/offline states beyond color alone.
- [ ] **Step 5: Run admin tests, `npm run typecheck`, and `npm run build`.**

### Task 7: Bunker TV, adaptive wagon presentation, and motion

**Files:**
- Modify: `src/features/bunker/BunkerScreenGuard.tsx`
- Modify: `src/features/bunker/BunkerEmergencyScene.tsx`
- Modify: `src/features/bunker/BunkerQuestScene.tsx`
- Modify: `src/styles/bunker.css`
- Modify: `src/styles/bunker-quest.css`
- Test: `src/features/bunker/BunkerScreenGuard.test.tsx`
- Test: `src/features/bunker/BunkerEmergencyScene.test.tsx`
- Test: `src/features/bunker/BunkerQuestScene.test.tsx`

**Interfaces:**
- Consumes: current server scene, active wagon count, scope, and server-derived timestamps.
- Produces: `.bunker-wagon-grid[data-count="2|3|4|5"]`, ≥5% safe area, reload-safe current scene, reduced-motion alternative.

- [ ] **Step 1: Add parameterized failing tests** for 2, 3, 4, and 5 wagon layouts and for restored scene/timer after remount.
- [ ] **Step 2: Run focused TV tests** and confirm the dynamic layout selector assertion fails.
- [ ] **Step 3: Remove fixed five-column presentation assumptions** and map only active wagons from runtime data.
- [ ] **Step 4: Add blackout, single sync tear, masked reveal, and train-window wipe**, disabling decorative animation under reduced motion.
- [ ] **Step 5: Run focused tests and `npm run build`.**

### Task 8: Generate and integrate Bunker imagery

**Files:**
- Create: `public/images/bunker/tunnel-relief-wide.png`
- Create: `public/images/bunker/tunnel-relief-mobile.png`
- Create: `public/images/bunker/train-tunnel.png`
- Create: `public/images/bunker/bunker-exterior.png`
- Create: `public/images/bunker/bunker-door-closed.png`
- Create: `public/images/bunker/bunker-door-open.png`
- Create: `public/images/bunker/evidence-01.png` through `evidence-06.png`
- Create: `public/images/bunker/tunnel-map-master.png`
- Create: `public/images/bunker/archive-bk17.png`
- Create: `public/images/bunker/archive-card.png`
- Create: `public/images/bunker/archive-document.png`
- Modify: Bunker player/TV styles and scene components.

**Interfaces:**
- Produces: monochrome, text-free restricted-archive assets suitable for dynamic 2–5 wagon fragments.

- [ ] **Step 1: Measure each visual slot and define crop requirements** for phone, desktop, and TV.
- [ ] **Step 2: Generate each distinct asset with a separate Canvas/ImageGen call** grounded in reference 01 and the approved palette.
- [ ] **Step 3: Inspect outputs** for unwanted text, neon cyberpunk styling, cheap glitch effects, watermarks, and unusable crops.
- [ ] **Step 4: Persist the accepted files under `public/images/bunker`** and integrate without changing mission answers or state transitions.
- [ ] **Step 5: Run Bunker tests and `npm run build`.**

### Task 9: Tournament artbook presentation

**Files:**
- Modify: `src/features/mortalKombat/MortalKombatPage.tsx`
- Modify: `src/features/mortalKombat/PublicBracket.tsx`
- Modify: `src/features/mortalKombat/MkFightScene.tsx`
- Modify: `src/features/mortalKombat/ChampionScene.tsx`
- Modify: `src/features/mortalKombat/MkScreenPage.tsx`
- Modify: `src/styles/mortal-kombat.css`
- Modify: `src/styles/mk-artbook.css`
- Test: existing component test files under `src/features/mortalKombat/`.

**Interfaces:**
- Consumes: existing signup, bracket, fight, milestone, champion, realtime, and admin state.
- Produces: original stone-arena artbook layout and mobile bracket progress without fixed four-column overflow.

- [ ] **Step 1: Add failing tests** for real participant names, semantic bracket progression, mobile-accessible rounds, reconnect state, and absence of official MK imagery/copy.
- [ ] **Step 2: Run all `src/features/mortalKombat/*.test.*` tests** and verify new assertions fail.
- [ ] **Step 3: Recompose presentation around an original arena, central railway/wedding arcade altar, and large guest-name typography**, preserving all service calls.
- [ ] **Step 4: Replace fixed bracket width assumptions** with scroll-snap/progressive round navigation and visible keyboard focus.
- [ ] **Step 5: Run tournament tests and `npm run build`.**

### Task 10: Generate and integrate original tournament assets

**Files:**
- Create: `public/images/tournament/arena-wide.png`
- Create: `public/images/tournament/arena-mobile.png`
- Create: `public/images/tournament/fighter-left.png`
- Create: `public/images/tournament/fighter-right.png`
- Create: `public/images/tournament/arcade-altar.png`
- Create: `public/images/tournament/champion-hall.png`
- Create: `public/images/tournament/stone-texture.png`
- Modify: tournament styles and scene consumers.

**Interfaces:**
- Produces: original text-free art with no protected characters, dragon emblem, game UI, or logos.

- [ ] **Step 1: Measure arena, cutout, altar, and champion slots** and record transparent-background needs for fighters/altar.
- [ ] **Step 2: Generate one asset per Canvas/ImageGen call** using reference 04 only for composition, scale, editorial density, and stone/gold mood.
- [ ] **Step 3: Inspect for accidental franchise likeness, emblems, text, watermarks, edge halos, and weak mobile crops**; regenerate any failed item.
- [ ] **Step 4: Save accepted assets under `public/images/tournament`** and integrate as decorative imagery with real DOM guest names.
- [ ] **Step 5: Run tournament tests and `npm run build`.**

### Task 11: Free local sample-audio engine

**Files:**
- Create: `src/lib/audioManifest.ts`
- Create: `src/lib/audioManifest.test.ts`
- Create: `src/lib/sampleAudio.ts`
- Create: `src/lib/sampleAudio.test.ts`
- Modify: `src/lib/siteAudio.ts`
- Modify: `src/features/screen/screenAudio.ts`
- Modify: `src/features/bunker/bunkerAudio.ts`
- Create: `public/audio/ATTRIBUTION.md`

**Interfaces:**
- Produces: `preloadCue(id)`, `playCue(id, { startedAt, offsetSeconds, loop, priority })`, `stopCue(id)`, `setMasterVolume(value)`, and `setMuted(value)`.
- Preserves: oscillator fallback only when a local file cannot decode or load.

- [ ] **Step 1: Write failing unit tests** with mocked `fetch`, `decodeAudioData`, and buffer sources for caching, mute/volume, priority ducking, timestamp offset, and non-replay of expired one-shots.
- [ ] **Step 2: Run `npm test -- src/lib/audioManifest.test.ts src/lib/sampleAudio.test.ts`** and confirm failure because the modules do not exist.
- [ ] **Step 3: Implement the typed manifest and shared decoded-buffer controller** without external runtime URLs.
- [ ] **Step 4: Adapt existing wedding/Bunker screen audio bridges** to call the shared player while retaining quiet oscillator fallbacks.
- [ ] **Step 5: Run audio tests, existing screen/Bunker audio tests, and `npm run build`.**

### Task 12: Acquire and sequence free sound assets

**Files:**
- Create: local files under `public/audio/arrival`, `public/audio/bunker`, `public/audio/terminal`, `public/audio/tournament`.
- Modify: `public/audio/ATTRIBUTION.md`
- Modify: `src/lib/audioManifest.ts`
- Modify: scene audio bridges and their tests.

**Interfaces:**
- Consumes: only assets with verified CC0 or compatible royalty-free terms.
- Produces: arrival, bunker launch, terminal, opening, and tournament timelines scheduled from server timestamps.

- [ ] **Step 1: Search only free libraries with explicit licence pages** for platform air, train approach, two-tone horn, pass-by, brake air, relay, alarm, pressure release, heavy door, key, scan, gong, and metal accents.
- [ ] **Step 2: Reject any file with unclear event-use rights**; record accepted source URL, author, licence, original filename, edits, and download date in `ATTRIBUTION.md`.
- [ ] **Step 3: Normalize local loudness and trim silence** using non-destructive copies; do not add a beat loop.
- [ ] **Step 4: Write timeline tests** proving reconnection joins ambience at the correct offset and does not replay an old horn, impact, or ticket stamp.
- [ ] **Step 5: Implement scene timelines and run all audio/screen tests plus `npm run build`.**

### Task 13: Functional, responsive, and visual QA

**Files:**
- Create: `design-qa.md`
- Modify: only files required by observed regressions.

**Interfaces:**
- Consumes: uploaded references 01–04 and completed local build.
- Produces: passed comparison record and verified app behavior.

- [ ] **Step 1: Run `npm run typecheck`, `npm test`, and `npm run build`** and record exact results.
- [ ] **Step 2: Start the verified local preview and inspect routes** `/`, `/join`, registered Guest Hub/Bunker state, `/admin`, `/screen`, `/mortal-kombat`, and `/mortal-kombat/screen`.
- [ ] **Step 3: Capture at 320, 390, 768, 1440, 1366×768, and 1920×1080**, including long names, 2–5 wagons, reduced motion, mute, offline/reconnect, and reload.
- [ ] **Step 4: Compare each prototype capture side-by-side with its uploaded reference** and record/fix hierarchy, crop, type, spacing, borders, contrast, and motion differences.
- [ ] **Step 5: Verify registration → wagon/character → current mission, TV reconnect, admin permissions, emergency open, game reset preserving wedding questionnaires, and no negative/duplicated resources.**
- [ ] **Step 6: Re-run the full typecheck/test/build suite** and mark `design-qa.md` passed only when every recorded blocker is resolved.

---

## Execution Order And Review Gates

1. Tasks 1–4: wedding and ticket checkpoint.
2. Tasks 5–8: Bunker player/admin/TV checkpoint.
3. Tasks 9–10: tournament checkpoint.
4. Tasks 11–12: free audio checkpoint.
5. Task 13: combined functional and visual acceptance.

Each checkpoint requires focused tests, typecheck, and production build before the next surface begins. No production deployment or database migration application is part of this plan.
