# Amendment — Multiple display clients and Russia-accessible deployment

Date: 2026-08-18
Status: Approved during implementation

## Goal

Allow the event to run on multiple TVs/screens in different rooms at the same time without giving every TV full owner/admin credentials, and avoid making the wedding dependent on the default `*.lovable.app` hostname being reachable from Russian networks without VPN.

## Multiple screens

The event supports more than one display client simultaneously.

Each TV/laptop/browser opened as a presentation screen is a separate read-only `screen client` with:

- stable `screen_id`;
- optional owner-defined name such as `Гостиная`, `Кухня`, `Терраса`;
- online/last-seen status;
- fullscreen/audio armed state;
- current presentation state/version.

### Pairing flow

Preferred production flow:

1. On a TV/laptop open the public screen-connect route, e.g. `/screen/connect`.
2. The device shows a short one-time pairing code and/or QR.
3. In `/admin`, owner sees the pending screen and presses `ПОДКЛЮЧИТЬ`.
4. Server issues a scoped, revocable screen credential bound to that screen client.
5. The screen switches to `/screen` and is presentation-only.
6. Owner names it if desired (`Гостиная`, `Кухня`, etc.).

A TV must not receive owner/admin mutation privileges merely to render the event.

For development/bootstrap, signing into the same owner account may remain a temporary fallback, but the target production UX is pairing with a screen-only capability.

### Broadcast behavior

Default owner commands broadcast to `ВСЕ ЭКРАНЫ` so all connected TVs show the same idle QR, quiz, Mortal Kombat state, announcements and premiere state.

Architecture must also support optional targeting of one or more named screens later, e.g. only `Терраса` or `Гостиная + Кухня`, without changing the core data model.

Premiere start uses the same authoritative future timestamp for every connected screen so countdown and playback begin as closely synchronized as the browsers/network permit.

### Admin status

`/admin` shows a screen list rather than a single binary projector status, for example:

- `Гостиная — ● онлайн — звук готов`
- `Кухня — ● онлайн — звук готов`
- `Терраса — ○ нет связи`

The overall readiness indicator may show `Экраны готовы: 2 / 3`.

The owner can revoke a lost/old screen credential and reconnect it later.

## Hosting and Russia-access requirement

The production event must not depend only on the default Lovable `*.lovable.app` hostname.

Lovable remains useful as the development/editor platform and may remain as a fallback published URL, but the guest-facing QR and production URL should use a custom event domain under infrastructure we control.

### Frontend deployment

The React/Vite frontend is portable and should be deployable from the GitHub repository to an external static host/CDN.

Preferred event setup:

- primary URL: custom domain, e.g. `go.<event-domain>` or the event root domain;
- primary frontend hosting: provider tested to work reliably from Russian fixed/mobile networks without VPN;
- `*.lovable.app`: development/fallback only, not the URL encoded into the public QR.

A Russia-oriented static host/CDN such as Yandex Object Storage + Cloud CDN is an appropriate deployment target for the frontend, because the app is a standard Vite/React SPA.

### Backend connectivity

Frontend availability alone is insufficient. Registration, realtime screen control, voting and tournament updates depend on backend/realtime connectivity.

Before the event, test the production backend from:

- venue Wi‑Fi;
- at least two Russian mobile operators where practical;
- owner phone and all display devices.

If Supabase remains the backend, client code should use a configurable backend base URL. A Supabase custom API domain or a controlled reverse-proxy path may be used when needed, but the design must not hardcode `*.supabase.co` throughout the application.

For the event-critical path, failure of a third-party project domain must be detectable in the admin technical-status strip.

## Venue fail-safe

Presentation clients cache the application shell and last valid screen state as already specified. If internet/realtime temporarily disappears:

- the TV keeps the last valid presentation instead of showing a browser error;
- countdown/premiere cannot be newly launched unless required readiness is green;
- after connectivity returns, screens refetch authoritative state and resubscribe;
- the owner sees which screens/backend connection are degraded.

The wedding video should be locally available/preloaded on each screen used for premiere where practical, so playback does not depend on streaming 263 MB at the exact premiere moment.

## Security

- Screen credentials are scoped to read presentation data and publish only their own presence/preflight heartbeat where required.
- Screen clients cannot mutate guest data, quiz state, bracket results, carriage assignments, event configuration, screen commands or premiere controls.
- Pairing codes are short-lived and single-use.
- Owner/admin remains the only full administrative identity.

## Testing requirements

1. Two or more screen clients can be paired and remain connected simultaneously.
2. A normal owner broadcast updates all active screens.
3. Removing/revoking one screen does not disconnect others.
4. Screen credentials cannot invoke owner mutations.
5. Admin shows per-screen online/audio/video readiness.
6. Reconnecting a screen restores current authoritative state.
7. Production build has configurable public join URL and backend URL; no guest-critical flow requires a `*.lovable.app` hostname.
8. SPA routing works on the external host for `/`, `/screen`, `/admin`, `/mortal-kombat`, etc.
9. Venue connectivity checklist tests frontend and backend separately.

## Acceptance criteria

- Owner can run at least two TVs in different rooms at once from one phone.
- TVs do not need the owner password in normal production operation.
- Guest QR points to a custom production domain intended to work without VPN.
- Lovable remains an editing/development option but is not a single point of failure for event access.
