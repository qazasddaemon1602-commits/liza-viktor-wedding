# Bunker V2 Persistent Player Dashboard — Design

## Goal

Keep the seven guest dashboard sections useful for the entire Bunker V2 run instead of making their data depend on whichever mission is currently active.

The persistent dashboard must preserve the existing frozen V2 runtime contract and add a separate read-only projection for durable player-facing state.

## Scope

The guest dashboard continues to expose:

- МОЙ ВАГОН
- ПЕРСОНАЖ
- ПАССАЖИРЫ
- ИНВЕНТАРЬ
- АРХИВ
- СОСТОЯНИЕ
- ТЕКУЩЕЕ ЗАДАНИЕ

This change affects the persistent data behind ПАССАЖИРЫ, ИНВЕНТАРЬ, АРХИВ, and СОСТОЯНИЕ. Mission-specific interaction screens remain separate and unchanged.

## Compatibility Boundary

Do not change the existing `BunkerV2ActiveGuestRuntime` shape. It remains the authoritative minimal runtime contract used for state, viewer identity, character, and current mission identity.

Add one separate read-only RPC and one TypeScript service/model for the persistent dashboard projection. This avoids coupling every mission parser to unrelated long-lived dashboard data and avoids breaking existing V2 consumers.

Legacy V1 behavior remains untouched.

## Server Read Model

Add a guest-only RPC with the following conceptual contract:

`get_guest_bunker_v2_dashboard(event_slug, device_key)`

It returns only data that the authenticated-by-device registered guest is allowed to see for the active V2 run.

### Viewer and wagon

Return the current guest and their current enabled wagon. The device key must resolve through the existing Bunker guest identity helper. A guest cannot request another wagon's projection.

### Passengers

Return every registered guest currently assigned to the viewer's wagon, including:

- real guest name
- profession
- visible skill
- character status: active / saved / excluded
- whether the hidden trait has been revealed
- hidden trait only when already revealed by authoritative game state

No unpublished hidden trait may be returned.

Late guests remain visible after assignment and continue participating normally.

### Inventory

Return the viewer wagon's current inventory ledger summarized by item key and state.

The player-facing default is the usable remainder, but the read model may also expose used/transferred quantities when needed to explain history. It must derive from `bunker_inventory_lots`, not from an old mission snapshot.

Trades and mission consumption therefore remain visible after leaving M03/M04.

### Archive

Return only archive entries to which the viewer is currently entitled through `bunker_archive_entitlements`.

Allowed scopes:

- the viewer's wagon
- global

Do not return archive entries belonging only to another wagon.

The projection may include public artifact metadata/content needed by the existing archive UI, but must never expose locked private data, final canonical values, or another wagon's private fragment.

### Wagon state

Return the current authoritative row from `bunker_wagon_state` for the viewer's wagon:

- power
- communication
- navigation
- technical door
- track damage
- water
- route choice
- route bonus
- power instability
- sector-04 discovery flag
- coordination bonus

This projection persists across every mission transition.

## Security

The RPC is `security definer` with an empty search path and explicit schema qualification, matching the V2 RPC pattern.

It must:

1. resolve the event by normalized slug;
2. resolve the guest from the existing event/device-key identity path;
3. require an active run with `contract_version = 2`;
4. scope every query by `event_id`, `run_nonce`, and the guest's own carriage;
5. return idle/not-found/legacy states without leaking data;
6. keep direct table access revoked.

The dashboard RPC must not return:

- final `canonical_value` / `normalized_value`
- unrevealed hidden traits
- another wagon's private archive entitlement
- another wagon's private mission fragment
- owner-only diagnostics

## Client Integration

Add a small `dashboard.service.ts` parser/loader for the new read model.

The guest live-state hook loads this projection independently from mission projections. A temporary dashboard projection failure must not blank the authoritative runtime or active mission. The last valid dashboard snapshot stays visible with the existing connection warning until a later refresh succeeds.

`BunkerPlayerDashboard` receives the projection as an optional prop. For V2:

- ПАССАЖИРЫ uses persistent dashboard passengers rather than M01 members;
- ИНВЕНТАРЬ uses persistent inventory rather than M03/M04 mission snapshots;
- АРХИВ uses the persistent entitled archive;
- СОСТОЯНИЕ renders the actual wagon-state values rather than generic explanatory copy.

Mission components and `ТЕКУЩЕЕ ЗАДАНИЕ` continue to use their existing mission-specific models.

During `BUNKER_OPEN` / `FINISHED`, the dedicated results screen still replaces the normal dashboard.

## Refresh and Resilience

Reuse the existing guest refresh/realtime cadence rather than adding another independent high-frequency subscription.

The projection should refresh on:

- existing Bunker realtime refresh events;
- the guest live-state polling cycle;
- focus recovery;
- network-online recovery.

A slow dashboard RPC must not block the base runtime from appearing.

## Testing

### RED contract tests

Add pgTAP coverage that proves:

- the dashboard RPC exists;
- anon/authenticated can execute only the RPC, not the backing tables;
- the function body scopes archive entitlements to wagon/global ownership;
- the function body does not read final canonical/normalized values for output;
- V2-only gating is present.

Add TypeScript parser/service tests for completed, idle, not-found, and malformed payloads.

Add dashboard component tests proving persistent data remains visible when no mission-specific model is supplied.

Add a hook/integration regression proving transition from M03/M04 to M05 does not erase inventory, archive, passengers, or wagon state.

### Release scenario

Extend the full rehearsal E2E so one guest's persistent dashboard is checked before and after at least one mission transition. The expectation is that durable information survives even though the active mission projection changes.

## Non-goals

- No writable dashboard endpoint.
- No redesign of mission mechanics.
- No mutation of archived V1 contracts.
- No direct client table queries.
- No exposure of final answers before the story resolves them.
- No new realtime channel.

## Acceptance Criteria

The feature is complete when a V2 guest can move from early missions through M05/M06 while the seven-section dashboard continues to show the correct current wagon passengers, inventory, archive, and wagon status; revealed information persists, secret information remains hidden, and loss of a mission-specific model does not empty durable dashboard data.
