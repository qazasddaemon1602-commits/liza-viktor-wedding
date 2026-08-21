# Overnight QA and Visual Polish Design

## Goal

Bring the wedding live hub to rehearsal-ready quality without changing its event architecture: finish automated verification, reconcile the implementation with the agreed scenario, improve the operator workflow, and strengthen projector visuals with safe animation layers.

## Working rules

- Work only on `feat/admin-rehearsal-links` until verification is green.
- `love-story-live` is the active GitHub/Lovable project; `main` is not changed during the pass.
- Do not use Work or Lovable AI for design in this pass.
- Existing RPC/realtime/state machines remain the source of truth. Visual components never create their own event state.

## Scenario requirements

- Registration remains open after composition lock and after premiere unless owner explicitly closes it.
- Late arrivals remain eligible for participation.
- Multiple `/screen` clients stay synchronized from server/realtime state.
- Premiere countdown is exactly 10→1, never 0.
- Premiere technical readiness requires an online screen, video readiness, and armed audio; guest count remains advisory.
- Premiere protected mode suppresses ordinary guest/train/call/quiz presentation.
- Bunker is highest priority: emergency message → changed route → safe point `БУНКЕР` → authoritative 30:00 timer.
- Bunker suppresses underlying premiere/MK/quiz/arrival presentation, holds at 00:00, and exits only on owner STOP.
- Rehearsal reset clears guests/runtime/MK/Bunker and preserves couple preanswers plus premiere media configuration.
- Mortal Kombat supports 16 active players + waitlist, owner draw/corrections, projector presentation, no-show replacement and champion state.
- Couple and Final Five access remains tokenized/private.

## Admin rehearsal launcher

Add a compact `РЕПЕТИЦИЯ` panel directly below the admin header. It exposes five same-origin links in new tabs so the admin session remains open:

- `/screen` — `ОТКРЫТЬ ТВ`
- `/join` — `РЕГИСТРАЦИЯ ГОСТЯ`
- `/play` — `КВИЗ`
- `/mortal-kombat` — `MK`
- `/mortal-kombat/screen` — `MK НА ТВ`

Relative paths guarantee the same UI works on Lovable and a future `.ru` domain.

## Projector visual hierarchy

The visual hierarchy stays deterministic:

1. Bunker emergency
2. Premiere
3. Mortal Kombat
4. Quiz / answer reveal
5. Carriage call / guest arrival
6. Idle QR screen

Decorative animation must remain inside the active scene and must not introduce competing full-screen fixed layers above protected modes.

## Train arrival visual

The guest registration moment should visibly read as a train arrival, not a generic card. Keep the existing `train-arrival-scene` contract and server event, but improve its visual implementation:

- cinematic side-view locomotive/train silhouette built from lightweight DOM/SVG shapes;
- track movement and restrained steam/light motion;
- train travels across the lower/middle projector frame;
- passenger name, ticket and carriage remain the information focus;
- entrance and exit duration stays short enough not to block subsequent event moments;
- audio continues through the existing armed `screenAudio` controller and remains stoppable by protected modes;
- CSS respects `prefers-reduced-motion` and avoids expensive full-screen blur/filter loops.

## Other visual polish

- Idle screen: subtle ambient rail-line motion and hierarchy around QR, no distracting overlay.
- Carriage call: clear dispatch-board style entry, visually distinct from guest arrival.
- MK: keep current bracket/fight/milestone state; improve transitions only inside existing scene components.
- Bunker: retain current high-priority emergency styling; no decorative animation may obscure timer or emergency copy.
- Admin: preserve mobile-first operator legibility and touch targets.

## Verification

Required evidence before merge:

- hosted `npm install` succeeds;
- `npm run typecheck` passes;
- `npm test` passes with unit scope only;
- `npm run build` passes;
- clean local Supabase applies migrations 001→025;
- Playwright global setup uses owner RPC, not direct privileged table mutations;
- Playwright covers registration/train, composition lock + late arrival, protected premiere, late guest after premiere, two-screen Bunker, Bunker over active premiere, and security boundaries;
- DB/pgTAP workflow remains available for `supabase/tests` changes.

## Completion rule

Do not merge to `main` until hosted CI is green. A real two-TV + phone rehearsal is still required after automated green before final event-day GO.
