# Task 5 report — Character ability action

## Scope delivered

- Added a server-authoritative ability catalogue for all 35 distinct ability keys used by the 36 enabled character profiles. Each key has one applicable mission; Mission 01 and every non-matching state return an explicit `ability_not_applicable` preview.
- Added `use_guest_bunker_ability(text, text, uuid)`. The RPC derives the active guest, run, wagon, character, mission and effect on the server; the phone sends only event/device identity and a client action UUID.
- Serialized use through `FOR UPDATE`, decremented the profile charge exactly once, stored `ability_used_at`, and made response-loss retries idempotent through `clientActionId`.
- Recorded `character_ability_used` in `bunker_game_events` with guest, wagon, mission, ability, effect and the returned result. A partial unique index protects the action identity in addition to row locking.
- Applied only state fields already supported by the model: stable power, unlocked technical door, stable water, working communication/coordination, and M05 route/sector hints. Other abilities return and store a concrete `mission_clue` instead of fabricating wagon state.
- Added the authoritative applicability preview to the guest runtime and an explicit current-mission card with remaining count, confirmation, success/error feedback and retry-safe client behaviour.
- Kept the character tab explanation and matched the existing Bunker phone design system. Ability controls are at least 48px tall; Task 6 owns the later 52px large-mode target.

## Explicit content ruling

The existing data describes narrative abilities but does not define executable effects. The smallest honest catalogue groups abilities by their existing descriptions and M02–M06 mission themes. Direct database mutations are limited to fields that already exist. All remaining abilities produce a named, human-readable mission clue that is returned to the player and preserved for the host history. Mission submission semantics were not changed.

## RED evidence

The UI/service tests were authored before their production paths and initially failed because no ability preview parser, RPC call, retry identity, confirmation card or GuestJoin integration existed.

The CSS contract was also observed RED before styling:

`npm test -- --run src/styles/bunker-mission-actions.scope.test.ts`

- 1 failed, 3 passed: `.bunker-player-ability-action button` did not yet guarantee `min-height: 48px`.

The pgTAP assertions were added before the migration. They cover function grants, M01 rejection, full character-catalogue applicability, authorization, decrement, supported wagon mutation, canonical event history, same-ID idempotency, distinct-ID rejection and clue-only no-op protection.

## GREEN evidence

- Targeted Vitest: 5 files passed, 46 tests passed.
- Full Vitest: 163 files passed, 847 tests passed.
- TypeScript: `npm run typecheck` passed.
- Production build: `npm run build` passed (existing bundle-size warning only).
- Whitespace: `git diff --check` passed.

## Database verification status

`npx --yes supabase@latest test db supabase/tests/bunker_global_mission_progress.sql --local` could not connect to `127.0.0.1:54322`. `supabase status` confirms that neither Docker nor Podman is available in this environment. The pgTAP plan is now 74 assertions and remains a required database-CI/release gate; no local database pass is claimed.

## Security and concurrency self-review

- The SECURITY DEFINER RPC and runtime wrapper use an empty search path and schema-qualified objects. Internal/helper functions are revoked from public roles; only guarded public entry points are granted to `anon`/`authenticated`.
- The server ignores any client claim about ability key, mission, effect, guest or wagon. Device binding, enabled wagon, active run and assigned profile are derived authoritatively.
- The active event state row and then the guest profile row are locked in a stable order. Same-ID retry lookup happens while those locks are held; two distinct final-charge requests serialize and the loser receives `ability already used`.
- Same-ID retries return the stored result with `changed: false` and `idempotent: true`, without another decrement, state mutation or event.
- Narrative effects never update wagon fields. The pgTAP snapshot assertion proves a `mission_clue` leaves the wagon row unchanged while preserving its concrete result in history.
- No Lovable UI, remote database or production deployment was touched.
