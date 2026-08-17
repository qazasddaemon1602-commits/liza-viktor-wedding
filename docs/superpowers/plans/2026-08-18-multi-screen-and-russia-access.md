# Multi-Screen & Russia-Accessible Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one owner phone control multiple read-only TVs/screens at once and deploy the guest-facing app on a custom production domain that does not depend on `*.lovable.app` reachability.

**Architecture:** Screen devices pair through short-lived one-time codes and receive scoped screen credentials; all screens subscribe to authoritative event/screen state and report per-device presence/preflight. The Vite frontend is deployed from GitHub to an external static host/CDN behind a custom domain, while backend URL remains configurable so Supabase or a proxied/custom-domain endpoint can be swapped without rebuilding application logic.

**Tech Stack:** React, TypeScript, Supabase Auth/PostgreSQL/Realtime, Vite environment config, Vitest, Testing Library, static SPA hosting/CDN, DNS/TLS.

## Global Constraints

- Owner/admin remains the only full administrative identity.
- Normal production TVs do not need owner credentials.
- Pairing codes are single-use, short-lived, and server-validated.
- Screen credential may read presentation state and update only its own heartbeat/preflight fields.
- Default owner screen command target is `ВСЕ ЭКРАНЫ`.
- Guest QR must point to a custom production URL, not `*.lovable.app`.
- Frontend and backend base URLs must be configurable; do not scatter hardcoded Lovable/Supabase hostnames through feature code.
- Production readiness must be tested on venue Wi-Fi and Russian mobile networks before 30.08.2026.
- Existing protected-screen priority and premiere timestamp rules remain unchanged.

---

## File Structure

- `supabase/migrations/006_multi_screen_pairing.sql` — display clients, pairing codes, scoped screen sessions, RLS/RPCs.
- `supabase/tests/multi_screen_pairing.sql` — pairing and authorization DB tests.
- `src/features/screen/pairing/screenPairing.service.ts` — create/claim/revoke screen pairing operations.
- `src/features/screen/pairing/ScreenPairingPage.tsx` — TV-side short code/QR pairing UI.
- `src/features/admin/screens/AdminScreensPanel.tsx` — owner list of pending/connected screens and readiness.
- `src/features/screen/presence/screenPresence.ts` — heartbeat and preflight publishing.
- `src/config/runtimeConfig.ts` — public URL and backend URL normalization.
- `src/config/runtimeConfig.test.ts` — config tests.
- `vite.config.ts` — SPA build behavior only; no provider-specific secret logic.
- `deploy/yandex/README.md` — exact production deployment checklist for static hosting/CDN/custom domain.
- `public/_redirects` or provider-equivalent config only if selected host needs it; Yandex Object Storage setup uses index/error routing documented in deploy guide.

---

### Task 1: Add multi-screen data model and pairing authorization

**Files:**
- Create: `supabase/migrations/006_multi_screen_pairing.sql`
- Create: `supabase/tests/multi_screen_pairing.sql`

**Interfaces:**
- `display_clients(id,event_id,name,status,last_seen_at,audio_armed,video_ready,created_at,revoked_at)`.
- `screen_pairing_codes(id,event_id,code_hash,expires_at,consumed_at,created_by)`.
- `owner_create_screen_pairing(event_id uuid) returns jsonb`.
- `claim_screen_pairing(event_id uuid, code text, device_key text) returns jsonb`.
- `owner_revoke_screen(screen_id uuid) returns void`.

- [ ] **Step 1: Write failing DB tests**

```sql
begin;
select plan(5);
select has_table('public','display_clients','display_clients exists');
select has_table('public','screen_pairing_codes','pairing codes exist');
select throws_ok($$ select public.owner_create_screen_pairing(current_setting('app.event_id')::uuid) $$,'42501',null,'anonymous cannot mint pairing codes');
select throws_ok($$ select public.owner_revoke_screen(gen_random_uuid()) $$,'42501',null,'anonymous cannot revoke screens');
select function_returns('public','claim_screen_pairing',ARRAY['uuid','text','text'],'jsonb','screen claim RPC exists');
select * from finish();
rollback;
```

- [ ] **Step 2: Run DB tests and verify RED**

Run: `supabase db reset && supabase test db`
Expected: FAIL because the tables/RPCs do not exist.

- [ ] **Step 3: Implement tables, indexes and RPCs**

Pairing codes expire after a short window (e.g. 5 minutes), are consumed atomically, and never store plaintext code after creation beyond what is returned once to owner/screen flow. `claim_screen_pairing` creates or binds one display client and returns only a scoped session capability/token reference.

- [ ] **Step 4: Add RLS**

Owner can list/manage all screens for the event. A scoped screen session can read public presentation state and update only its own presence/preflight record. Guests/Liza/Viktor cannot enumerate screen sessions or mint/revoke credentials.

- [ ] **Step 5: Run DB tests**

Run: `supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_multi_screen_pairing.sql supabase/tests/multi_screen_pairing.sql
git commit -m "feat: add secure multi-screen pairing"
```

---

### Task 2: Build TV pairing page and screen-only session bootstrap

**Files:**
- Create: `src/features/screen/pairing/screenPairing.service.ts`
- Create: `src/features/screen/pairing/screenPairing.service.test.ts`
- Create: `src/features/screen/pairing/ScreenPairingPage.tsx`
- Create: `src/features/screen/pairing/ScreenPairingPage.test.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Route: `/screen/connect`.
- `requestPairingCode()` returns `{ pairingId, code, expiresAt }` or a clear unavailable state.
- `claimPairing(code, deviceKey)` returns `{ screenId, screenSessionToken }`.

- [ ] **Step 1: Write failing UI/service tests**

```tsx
it('shows a short pairing code instead of asking for owner credentials', async () => {
  render(<ScreenPairingPage />);
  expect(await screen.findByText(/подключить этот экран/i)).toBeInTheDocument();
  expect(screen.queryByText(/пароль администратора/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/screen/pairing`
Expected: FAIL.

- [ ] **Step 3: Implement pairing UI**

Display a large 6-character code and optional QR for owner scanning. Show expiration countdown and regenerate action. After server-confirmed claim, persist only the screen-scoped session material and navigate to `/screen`.

- [ ] **Step 4: Ensure owner login is not required on TV**

The normal production route never renders owner sign-in. A development-only owner-auth fallback may remain behind an explicit dev flag but is disabled in production config.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/screen/pairing`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen/pairing src/app/routes.tsx
git commit -m "feat: add screen pairing flow"
```

---

### Task 3: Add owner connected-screen panel and per-screen readiness

**Files:**
- Create: `src/features/admin/screens/AdminScreensPanel.tsx`
- Create: `src/features/admin/screens/AdminScreensPanel.test.tsx`
- Create: `src/features/screen/presence/screenPresence.ts`
- Create: `src/features/screen/presence/screenPresence.test.ts`
- Modify: `src/features/admin/status/AdminTechnicalStatus.tsx`

**Interfaces:**
- Owner list item: `{ id, name, online, lastSeenAt, audioArmed, videoReady }`.
- Default command target: `all`.
- Presence heartbeat updates only the current screen record.

- [ ] **Step 1: Write failing admin tests**

```tsx
it('shows readiness for each connected display', () => {
  render(<AdminScreensPanel screens={fixtures} />);
  expect(screen.getByText('Гостиная')).toBeInTheDocument();
  expect(screen.getByText('Кухня')).toBeInTheDocument();
  expect(screen.getByText(/экраны готовы: 2 \/ 3/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/admin/screens src/features/screen/presence`
Expected: FAIL.

- [ ] **Step 3: Implement screen list, naming and revoke**

Owner can approve pending screen, rename it, inspect readiness, and revoke it. Revoking one screen must not affect other connected displays.

- [ ] **Step 4: Implement heartbeat/preflight**

Each screen publishes `last_seen_at`, `audio_armed`, and module-specific readiness such as `video_ready`. Admin marks a screen offline after grace expiry.

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npm test -- src/features/admin/screens src/features/screen/presence src/features/admin/status`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/screens src/features/screen/presence src/features/admin/status
git commit -m "feat: add multi-screen readiness panel"
```

---

### Task 4: Broadcast authoritative screen state to all displays

**Files:**
- Modify: `src/features/screen/screen.service.ts`
- Modify: `src/features/admin/screen/AdminScreenControls.tsx`
- Create: `src/features/screen/multiScreenBroadcast.test.ts`

**Interfaces:**
- `ScreenTarget = { kind: 'all' } | { kind: 'screen_ids'; ids: string[] }`.
- MVP owner commands use `{ kind: 'all' }` by default.

- [ ] **Step 1: Write failing broadcast tests**

```ts
it('defaults owner projector commands to all active displays', () => {
  expect(normalizeScreenTarget(undefined)).toEqual({ kind: 'all' });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/screen/multiScreenBroadcast.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement target normalization**

Keep one authoritative global event presentation state for MVP so all screens naturally render the same thing. Add a target envelope type now so room-specific routing can be introduced later without changing owner API signatures.

- [ ] **Step 4: Update admin copy**

Screen control header shows `Показывать: ВСЕ ЭКРАНЫ` by default and screen count/readiness nearby.

- [ ] **Step 5: Run screen/admin tests**

Run: `npm run typecheck && npm test -- src/features/screen src/features/admin/screen`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen src/features/admin/screen
git commit -m "feat: broadcast event state to all displays"
```

---

### Task 5: Make production URLs provider-independent

**Files:**
- Create: `src/config/runtimeConfig.ts`
- Create: `src/config/runtimeConfig.test.ts`
- Modify: `.env.example`
- Modify: `src/lib/supabase.ts` (or equivalent client bootstrap created by foundation plan)
- Modify: guest QR construction in screen/registration code.

**Interfaces:**
- `VITE_PUBLIC_APP_URL` — custom guest-facing production origin.
- `VITE_BACKEND_URL` / existing Supabase project URL variable — backend/realtime endpoint.
- `getJoinUrl()` returns `${PUBLIC_APP_URL}/` or configured short route.

- [ ] **Step 1: Write failing config tests**

```ts
it('builds the guest QR from the configured production origin', () => {
  expect(buildJoinUrl('https://wedding.example', '/')).toBe('https://wedding.example/');
});

it('does not require a lovable.app hostname', () => {
  expect(buildJoinUrl('https://wedding.example', '/')).not.toContain('lovable.app');
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/config/runtimeConfig.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement runtime config validation**

Normalize trailing slashes, reject missing production public URL in production builds, and keep backend URL in one bootstrap module. No feature component constructs Supabase/Lovable hostnames directly.

- [ ] **Step 4: Update QR usage**

Idle screen and any printable/public QR consume `getJoinUrl()` so switching hosts requires configuration only.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/config src/features/screen src/features/registration`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config .env.example src/lib src/features
git commit -m "feat: decouple production URLs from Lovable hosting"
```

---

### Task 6: Document external production deployment and venue network QA

**Files:**
- Create: `deploy/yandex/README.md`
- Create: `docs/event-runbook/network-readiness.md`

**Interfaces:**
- Deployment output is the Vite `dist/` directory.
- Custom domain serves SPA over HTTPS.
- Runbook distinguishes frontend reachability, backend API, Realtime WebSocket, and premiere media readiness.

- [ ] **Step 1: Write exact deployment checklist**

Include:

```text
1. Build with production VITE_PUBLIC_APP_URL and backend URL.
2. Upload dist/ to static hosting bucket.
3. Configure SPA index/error routing so deep links resolve to index.html.
4. Put CDN/custom domain/TLS in front of the bucket.
5. Verify /, /screen/connect, /screen, /admin and /mortal-kombat direct navigation.
6. Encode only the custom production domain into the event QR.
7. Keep Lovable URL as emergency/dev fallback, not public primary.
```

- [ ] **Step 2: Write venue QA matrix**

Test before 30.08.2026 from venue Wi-Fi and at least two mobile networks where practical:

```text
- HTTPS frontend opens without VPN
- QR registration loads
- registration write succeeds
- Realtime updates admin
- screen pairing succeeds
- screen command reaches every TV
- WebSocket reconnect succeeds after toggling network
- premiere video is locally ready/preloaded
```

- [ ] **Step 3: Add backend contingency note**

If `*.supabase.co` is unreliable on venue networks, switch configured backend endpoint to a Supabase custom API domain or approved reverse-proxy/custom-backend path and repeat the matrix. Do not discover this during the wedding.

- [ ] **Step 4: Review docs for secrets**

No API secret/service-role key is written into deployment docs, static env examples, QR links or client code.

- [ ] **Step 5: Commit**

```bash
git add deploy/yandex/README.md docs/event-runbook/network-readiness.md
git commit -m "docs: add resilient production deployment runbook"
```

---

## Self-Review

- Spec coverage: multiple simultaneous TVs, secure pairing, per-screen presence/readiness, all-screen broadcasts, custom production domain, external frontend hosting, configurable backend, venue network tests and Lovable independence all have tasks.
- Placeholder scan: no TBD/TODO implementation placeholders.
- Type consistency: `ScreenTarget`, `display_clients`, pairing RPCs and runtime config names are defined before use.
- Security: TVs never need full owner credentials in the target production flow and cannot mutate event state.
- Deployment: Lovable remains available for editing/publishing but is not encoded into the primary guest QR or treated as the sole hosting path.
