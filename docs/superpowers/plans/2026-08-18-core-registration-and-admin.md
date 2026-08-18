# Core Registration & Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production foundation of the 30 August 2026 celebration hub: React app shell, Supabase data/security, guest registration, Viktor Train carriage/team assignment, virtual tickets, owner-only admin guest management, recovery, notifications, and carriage calls.

**Architecture:** A Vite React + TypeScript SPA talks to Supabase through narrowly scoped service modules and database RPCs. Guest identity is anonymous/device-bound and never grants admin rights; privileged mutations are owner-only via `events.owner_user_id` plus RLS/RPC checks. `carriage_id` is the sole team identity and registration stays open for late arrivals without reshuffling existing guests.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, React Router, Supabase PostgreSQL/Auth/Realtime/Storage, Vitest, Testing Library.

## Global Constraints

- Wedding day: **29 August 2026**; interactive second day: **30 August 2026**.
- Exactly one admin identity: the owner Supabase Auth account; no reusable `host` role or public admin signup.
- Public guests do not create accounts; registration uses a stable device/session key.
- `carriage_id` is the canonical team identity; do not create a separate `team_id`.
- Initial capacity: approximately 40 guests across 5 carriages, balanced first by headcount and second by affiliation diversity.
- Existing carriage assignments never move automatically when late guests arrive.
- `ЗАФИКСИРОВАТЬ СОСТАВ` freezes existing assignments but does **not** close late registration.
- Carriage identity always shows both number/label and color/mark; never rely on color alone.
- Initial carriage accents: `#31483A`, `#9A6348`, `#7E3F3C`, `#78806A`, `#B49B7E`.
- Full guest list and affiliation details are owner-only.
- Public display of a person defaults to first name + surname initial.
- Event visual system: warm ivory/beige, deep muted green, cinnamon, restrained wine/brick red; avoid generic wedding-template styling.

---

## File Structure

Create these focused units:

- `package.json` — scripts and app dependencies.
- `src/main.tsx` — browser bootstrap only.
- `src/app/App.tsx` — router and top-level providers.
- `src/app/routes.tsx` — route definitions.
- `src/styles/globals.css` — tokens, typography, shared motion/accessibility rules.
- `src/lib/supabase.ts` — Supabase browser client.
- `src/lib/deviceIdentity.ts` — stable anonymous device key creation/recovery.
- `src/lib/eventConfig.ts` — event/date/join-url constants loaded from env.
- `src/features/registration/registration.types.ts` — guest registration types.
- `src/features/registration/registration.service.ts` — register/restore/recovery API calls.
- `src/features/registration/RegistrationPage.tsx` — first-time registration form.
- `src/features/registration/TicketReveal.tsx` — 1–2 second ticket issuance transition.
- `src/features/guest/GuestHubPage.tsx` — persistent guest home.
- `src/features/guest/VirtualTicket.tsx` — Viktor Train ticket component.
- `src/features/admin/auth/OwnerGate.tsx` — owner-only route guard.
- `src/features/admin/guests/AdminGuestsPage.tsx` — realtime guest list and filters.
- `src/features/admin/guests/GuestEditor.tsx` — edit/reassign/delete/recovery actions.
- `src/features/admin/notifications/AdminRegistrationToasts.tsx` — owner-only realtime notifications.
- `src/features/admin/AdminShell.tsx` — mobile admin layout/status navigation.
- `src/features/carriages/carriage.service.ts` — carriage reads/calls.
- `src/features/carriages/CarriageCallBanner.tsx` — targeted guest call UI.
- `supabase/migrations/001_core_event_registration.sql` — core schema, seed event/carriages, RPCs, RLS.
- `supabase/tests/registration.sql` — database authorization/allocation checks.
- `src/**/*.test.ts(x)` — unit/component tests colocated with features.

---

### Task 1: Scaffold the typed app and test harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/styles/globals.css`
- Create: `src/lib/eventConfig.ts`
- Create: `src/test/setup.ts`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`

**Interfaces:**
- Produces: `EVENT_DATE = '2026-08-30'`, `WEDDING_DATE = '2026-08-29'`, `EXPECTED_GUEST_COUNT = 40`, `PUBLIC_JOIN_URL`.
- Produces routes `/`, `/join`, `/play`, `/admin`, `/screen`, `/premiere`, `/mortal-kombat`, `/mortal-kombat/screen`.

- [ ] **Step 1: Write a failing configuration test**

```ts
// src/lib/eventConfig.test.ts
import { describe, expect, it } from 'vitest';
import { EVENT_DATE, WEDDING_DATE, EXPECTED_GUEST_COUNT } from './eventConfig';

describe('eventConfig', () => {
  it('pins the wedding and second-day dates', () => {
    expect(WEDDING_DATE).toBe('2026-08-29');
    expect(EVENT_DATE).toBe('2026-08-30');
    expect(EXPECTED_GUEST_COUNT).toBe(40);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/lib/eventConfig.test.ts`
Expected: FAIL because `eventConfig.ts` does not exist.

- [ ] **Step 3: Add the minimal scaffold and configuration**

```ts
// src/lib/eventConfig.ts
export const WEDDING_DATE = '2026-08-29';
export const EVENT_DATE = '2026-08-30';
export const EXPECTED_GUEST_COUNT = 40;
export const PUBLIC_JOIN_URL = import.meta.env.VITE_PUBLIC_JOIN_URL ?? window.location.origin;
```

```tsx
// src/app/App.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';

export function App() {
  return <RouterProvider router={router} />;
}
```

Use CSS custom properties in `globals.css` for `--ivory`, `--forest`, `--cinnamon`, `--wine`, `--sage`, `--sand`, plus the five carriage accent tokens.

- [ ] **Step 4: Run typecheck and tests**

Run: `npm run typecheck && npm test -- src/lib/eventConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html src vite.config.ts tsconfig*.json
git commit -m "feat: scaffold wedding celebration app"
```

---

### Task 2: Create core Supabase schema, single-owner security, and carriage seeds

**Files:**
- Create: `supabase/migrations/001_core_event_registration.sql`
- Create: `supabase/tests/registration.sql`
- Create: `src/lib/supabase.ts`
- Create: `src/lib/database.types.ts`

**Interfaces:**
- Produces tables: `events`, `event_state`, `carriages`, `guests`, `guest_device_bindings`, `guest_recovery_codes`, `carriage_calls`, `carriage_call_targets`, `owner_action_log`.
- Produces RPCs: `register_guest`, `recover_guest`, `owner_reassign_guest`, `owner_delete_guest`, `owner_lock_composition`, `owner_create_carriage_call`, `owner_clear_carriage_call`.

- [ ] **Step 1: Write database tests first**

```sql
-- supabase/tests/registration.sql
begin;
select plan(6);

select has_table('public', 'events', 'events exists');
select has_table('public', 'guests', 'guests exists');
select has_table('public', 'carriages', 'carriages exists');
select col_is_unique('public', 'guest_device_bindings', ARRAY['event_id','device_key'], 'one binding per event/device');
select policies_are('public', 'guests', ARRAY['owner reads all guests'], 'guest table is not publicly enumerable');
select function_returns('public', 'register_guest', ARRAY['uuid','text','text','text','text'], 'jsonb', 'registration rpc exists');

select * from finish();
rollback;
```

- [ ] **Step 2: Run database tests and verify failure**

Run: `supabase db reset && supabase test db`
Expected: FAIL because schema/RPCs do not exist.

- [ ] **Step 3: Implement schema and owner boundary**

Core columns:

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  wedding_date date not null default '2026-08-29',
  event_date date not null default '2026-08-30',
  expected_guest_count integer not null default 40,
  registration_open boolean not null default true,
  composition_locked boolean not null default false,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.carriages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  number integer not null,
  label text not null,
  accent_hex text not null,
  visual_mark text not null,
  sort_order integer not null,
  enabled boolean not null default true,
  unique(event_id, number)
);
```

Seed the five carriage labels/accents. Every privileged policy must use an `exists (...) where events.owner_user_id = auth.uid()` check. Do **not** add a `host` role.

- [ ] **Step 4: Add generated database types and client**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

- [ ] **Step 5: Run database tests again**

Run: `supabase db reset && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase src/lib/supabase.ts src/lib/database.types.ts
git commit -m "feat: add secure event and guest schema"
```

---

### Task 3: Implement device identity and smart guest registration RPC

**Files:**
- Create: `src/lib/deviceIdentity.ts`
- Create: `src/lib/deviceIdentity.test.ts`
- Create: `src/features/registration/registration.types.ts`
- Create: `src/features/registration/registration.service.ts`
- Modify: `supabase/migrations/001_core_event_registration.sql`
- Modify: `supabase/tests/registration.sql`

**Interfaces:**
- Produces `getOrCreateDeviceKey(): string`.
- Produces `registerGuest(input): Promise<RegisteredGuest>`.
- `RegisteredGuest` includes `id`, `firstName`, `lastName`, `affiliationType`, `affiliationDetail`, `carriage`, `ticketNumber`.

- [ ] **Step 1: Write device identity tests**

```ts
it('reuses the same persisted device key', () => {
  const first = getOrCreateDeviceKey();
  const second = getOrCreateDeviceKey();
  expect(second).toBe(first);
});
```

- [ ] **Step 2: Write SQL allocation tests**

Create registrations alternating `liza`, `viktor`, `family`, `common` affiliations and assert after 40 registrations that max carriage size minus min carriage size is at most 1, and no affiliation is unnecessarily concentrated when another least-populated carriage offers better diversity.

- [ ] **Step 3: Run tests and verify failures**

Run: `npm test -- src/lib/deviceIdentity.test.ts && supabase test db`
Expected: FAIL.

- [ ] **Step 4: Implement stable device key and registration service**

```ts
const STORAGE_KEY = 'lvw:device-key';

export function getOrCreateDeviceKey(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}
```

The `register_guest` RPC must execute in one transaction: normalize names, return the existing bound guest for the same device, soft-detect same-name duplicates, select among least-populated carriages, score affiliation diversity, create guest + device binding + ticket number, append an owner action log entry, then return only that guest's safe profile.

- [ ] **Step 5: Verify idempotency and late-arrival behavior**

Run: `npm test -- src/lib/deviceIdentity.test.ts && supabase test db`
Expected: PASS, including same-device reentry and no reassignment of existing guests after composition lock.

- [ ] **Step 6: Commit**

```bash
git add src/lib/deviceIdentity* src/features/registration supabase
git commit -m "feat: add balanced persistent guest registration"
```

---

### Task 4: Build registration form, ticket reveal, and guest hub

**Files:**
- Create: `src/features/registration/RegistrationPage.tsx`
- Create: `src/features/registration/RegistrationPage.test.tsx`
- Create: `src/features/registration/TicketReveal.tsx`
- Create: `src/features/guest/VirtualTicket.tsx`
- Create: `src/features/guest/VirtualTicket.test.tsx`
- Create: `src/features/guest/GuestHubPage.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- Registration fields: `firstName`, `lastName`, `affiliationType`, optional `affiliationDetail`.
- Duplicate warning supports explicit `Это другой человек` confirmation.
- Guest hub consumes the restored `RegisteredGuest` and never enumerates other guests.

- [ ] **Step 1: Write component tests**

```tsx
it('requires first and last name and affiliation', async () => {
  render(<RegistrationPage />);
  await user.click(screen.getByRole('button', { name: /получить билет/i }));
  expect(await screen.findByText(/введите имя/i)).toBeInTheDocument();
  expect(screen.getByText(/введите фамилию/i)).toBeInTheDocument();
});

it('always renders carriage number in addition to accent color', () => {
  render(<VirtualTicket guest={fixtureGuest} />);
  expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/registration src/features/guest`
Expected: FAIL.

- [ ] **Step 3: Implement the phone-first registration UX**

Use affiliation options: `Со стороны Лизы`, `Со стороны Виктора`, `Общие друзья`, `Семья / родственники`, `Коллеги`, `Другое`. After success show `РЕГИСТРАЦИЯ ЗАВЕРШЕНА` → `Формируем маршрут…` for roughly 1–2 seconds, then reveal the ticket.

Ticket content must include `ЛИЗА × ВИКТОР`, date `30.08.2026`, full guest name on the private phone view, `ВАГОН №N`, ticket number, restrained carriage accent and mark.

- [ ] **Step 4: Add returning-device restore**

On `/join`, call restore first. If the device already has a bound guest, route directly to the guest hub instead of showing a second registration form.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run typecheck && npm test -- src/features/registration src/features/guest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/registration src/features/guest src/app/routes.tsx
git commit -m "feat: add guest registration and Viktor Train ticket"
```

---

### Task 5: Add owner authentication gate and realtime guest administration

**Files:**
- Create: `src/features/admin/auth/OwnerGate.tsx`
- Create: `src/features/admin/auth/OwnerGate.test.tsx`
- Create: `src/features/admin/AdminShell.tsx`
- Create: `src/features/admin/guests/AdminGuestsPage.tsx`
- Create: `src/features/admin/guests/AdminGuestsPage.test.tsx`
- Create: `src/features/admin/guests/GuestEditor.tsx`
- Create: `src/features/admin/notifications/AdminRegistrationToasts.tsx`
- Create: `src/features/admin/notifications/notificationQueue.ts`
- Create: `src/features/admin/notifications/notificationQueue.test.ts`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- `OwnerGate` allows `/admin` only when authenticated `auth.uid()` matches the event owner returned by the protected owner bootstrap query.
- Admin list supports search/filter, edit metadata, manual carriage reassignment, duplicate deletion, composition lock, recovery-code issue.

- [ ] **Step 1: Write owner-gate and notification queue tests**

```tsx
it('does not render admin content for a non-owner session', async () => {
  render(<OwnerGate><div>SECRET ADMIN</div></OwnerGate>);
  expect(await screen.findByText(/доступ запрещён/i)).toBeInTheDocument();
  expect(screen.queryByText('SECRET ADMIN')).not.toBeInTheDocument();
});
```

```ts
it('preserves all near-simultaneous registration notices', () => {
  const queue = enqueueNotices([], [noticeA, noticeB, noticeC]);
  expect(queue.map(x => x.guestId)).toEqual(['a', 'b', 'c']);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/admin`
Expected: FAIL.

- [ ] **Step 3: Implement admin shell and realtime guest subscription**

Admin row fields: full name, affiliation/category/detail, `ВАГОН №N` + accent, registration time, recently-active state, later MK status. A successful new registration adds the row and a top toast: `НОВЫЙ ПАССАЖИР — Иван Петров · Вагон №3`.

Do not expose this subscription from guest, Liza, Viktor, or screen routes.

- [ ] **Step 4: Implement owner mutations and safe duplicate deletion**

Deletion must display dependent-data impact before confirmation. Reassignment remains possible after composition lock only as an explicit owner override. Add `ЗАФИКСИРОВАТЬ СОСТАВ` as a separate action from `Регистрация открыта/закрыта`.

- [ ] **Step 5: Implement owner-assisted recovery**

Generate a short-lived, single-use recovery code/link that binds a new device key to an existing guest record. The public recovery endpoint must not enumerate guests or accept arbitrary guest IDs without a valid one-time credential.

- [ ] **Step 6: Run frontend and DB authorization tests**

Run: `npm run typecheck && npm test -- src/features/admin && supabase test db`
Expected: PASS, including guest/non-owner mutation rejection.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin src/app/routes.tsx supabase
git commit -m "feat: add owner-only realtime guest admin"
```

---

### Task 6: Add carriage calls and persistent guest activity state

**Files:**
- Create: `src/features/carriages/carriage.service.ts`
- Create: `src/features/carriages/carriage.service.test.ts`
- Create: `src/features/carriages/CarriageCallBanner.tsx`
- Create: `src/features/carriages/AdminCarriageCalls.tsx`
- Modify: `src/features/guest/GuestHubPage.tsx`
- Modify: `src/features/admin/AdminShell.tsx`
- Modify: `supabase/migrations/001_core_event_registration.sql`

**Interfaces:**
- `createCarriageCall({ carriageIds, message, showOnScreen })` owner-only.
- Guest subscription receives only calls targeting its own `carriage_id`.

- [ ] **Step 1: Write call-targeting tests**

```ts
it('shows a call only to a targeted carriage', () => {
  expect(isCallForGuest(callForCarriage3, guestIn3)).toBe(true);
  expect(isCallForGuest(callForCarriage3, guestIn4)).toBe(false);
});
```

- [ ] **Step 2: Add DB tests for owner-only create/clear and target privacy**

Run: `supabase test db`
Expected: FAIL until policies/RPCs are complete.

- [ ] **Step 3: Implement call service and guest banner**

Support one or multiple carriage targets and owner-entered/preset copy. Guest hub shows a prominent call in the guest's own carriage accent while always keeping `ВАГОН №N` visible.

- [ ] **Step 4: Add admin call composer**

Owner can select carriage badges, enter/select message, choose `ВЫВЕСТИ НА ЭКРАН`, send, and clear the active call.

- [ ] **Step 5: Run all core tests**

Run: `npm run typecheck && npm test && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/carriages src/features/guest src/features/admin supabase
git commit -m "feat: add Viktor Train carriage calls"
```

---

## Self-Review

- Spec coverage: registration, affiliation, smart mixing, late arrivals, stable carriage/team, colors, ticket, owner-only guest list, duplicates, recovery, composition lock, admin notifications, calls, privacy and dates are mapped to Tasks 2–6.
- Placeholder scan: no `TBD`, `TODO`, vague “add error handling”, or undefined implementation task remains.
- Type consistency: `RegisteredGuest`, `carriage_id`, `device_key`, owner RPC naming, and five-carriage model are consistent across tasks.
- Deferred intentionally to separate plans: projector/event screen queue, quiz/couple answers, Mortal Kombat bracket, video premiere, PWA/offline presentation shell and final end-to-end event QA.
