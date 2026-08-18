# Screen, Realtime & Event Moments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the laptop/projector presentation system controlled from the owner's phone: animated idle QR, protected screen modes, realtime state recovery, event-moment queue, Viktor Train registration animation/sound, carriage announcements, emergency controls, presence and connection status.

**Architecture:** `/screen` is a read-only renderer driven by one authoritative `event_state` row plus a durable `screen_events` queue. Owner mutations happen from `/admin`; the projector subscribes through Supabase Realtime and keeps the last valid state during temporary connection loss. Ambient event moments can overlay idle mode, activity moments can appear only in their relevant module, and protected modes cannot be interrupted.

**Tech Stack:** React, TypeScript, Supabase Realtime/PostgreSQL, CSS/SVG animation, Web Audio/HTMLAudio, QR generation library, Vitest, Testing Library.

## Global Constraints

- `/screen` contains no admin mutation UI even when the same owner account is signed in on the laptop.
- Owner phone and laptop may use the same Supabase account simultaneously.
- Browser fullscreen/audio requires one local `ПОДКЛЮЧИТЬ ЭКРАН` action before event control becomes phone-only.
- Screen priority: premiere/countdown/video > owner-pinned/major reveal > active module > high-priority announcement > idle QR.
- Protected modes are never interrupted by automatic screen events: premiere countdown, premiere playback, black mode, owner-pinned screen, critical reveal animation.
- Idle QR itself never moves, scales, blurs, rotates, or loses quiet-zone contrast.
- Registration train animation lasts about 3–4 seconds; sound cue about 0.5–1.5 seconds; both are nonessential and can be muted.
- `prefers-reduced-motion` must preserve information with minimal motion.
- Public registration animation shows first name + surname initial, not full private registration metadata.
- Event screen uses the restrained green/beige/cinnamon/wine wedding system.

---

## File Structure

- `supabase/migrations/002_screen_realtime_events.sql` — screen state, screen events, presence/preflight state, owner RPCs/RLS.
- `supabase/tests/screen_state.sql` — screen authorization/priority/queue DB tests.
- `src/features/screen/screen.types.ts` — screen-mode/event payload types.
- `src/features/screen/screen.service.ts` — state/event reads, owner screen commands, subscriptions.
- `src/features/screen/useScreenState.ts` — resilient realtime state hook.
- `src/features/screen/ScreenPage.tsx` — presentation-only router/render switch.
- `src/features/screen/IdleScreen.tsx` — animated QR standby.
- `src/features/screen/ScreenEventLayer.tsx` — queued event moment renderer.
- `src/features/screen/RegistrationTrainMoment.tsx` — train arrival mini-scene.
- `src/features/screen/CarriageAnnouncementMoment.tsx` — carriage call scene.
- `src/features/screen/ScreenConnectGate.tsx` — one-time fullscreen/audio arming.
- `src/features/screen/audio/screenAudio.ts` — sound unlock/play/mute helpers.
- `src/features/screen/connection/connectionStore.ts` — realtime connection state and last-valid snapshot.
- `src/features/admin/screen/AdminScreenControls.tsx` — output/emergency controls.
- `src/features/admin/screen/AdminScreenEvents.tsx` — queue/settings/custom moment controls.
- `src/features/admin/status/AdminTechnicalStatus.tsx` — projector/realtime/audio/video/guest status strip.

---

### Task 1: Define authoritative screen state and owner-only commands

**Files:**
- Create: `supabase/migrations/002_screen_realtime_events.sql`
- Create: `supabase/tests/screen_state.sql`
- Create: `src/features/screen/screen.types.ts`
- Create: `src/features/screen/screen.service.ts`

**Interfaces:**
- `ScreenMode = 'idle' | 'question' | 'results' | 'couple_reveal' | 'tournament_bracket' | 'tournament_match' | 'premiere_standby' | 'premiere_countdown' | 'premiere_playing' | 'black' | 'champion'`.
- `setScreenState(input)` owner-only.
- `getPublicScreenState(eventId)` read-only safe projection.

- [ ] **Step 1: Write authorization tests**

```sql
begin;
select plan(4);
select has_table('public', 'event_state', 'event_state exists');
select function_returns('public', 'owner_set_screen_state', ARRAY['uuid','text','uuid','jsonb'], 'jsonb', 'owner command exists');
select throws_ok($$ select public.owner_set_screen_state(current_setting('app.event_id')::uuid, 'black', null, '{}'::jsonb) $$, '42501', null, 'anonymous cannot control screen');
select policies_are('public', 'event_state', ARRAY['public reads safe event state','owner updates event state'], 'state policies are explicit');
select * from finish();
rollback;
```

- [ ] **Step 2: Run DB tests and verify failure**

Run: `supabase db reset && supabase test db`
Expected: FAIL until migration exists.

- [ ] **Step 3: Implement the state model**

Add fields to `event_state`: `screen_mode`, `screen_payload_id`, `screen_payload jsonb`, `screen_pinned boolean`, `screen_updated_at`, `automatic_screen_events_enabled`, `screen_sounds_enabled`, `registration_sounds_enabled`.

`owner_set_screen_state` verifies `auth.uid() = events.owner_user_id`, writes action-log entry and never exposes a generic host capability.

- [ ] **Step 4: Add TypeScript discriminated union**

```ts
export type ScreenState =
  | { mode: 'idle'; payloadId: null; payload: null; pinned: false }
  | { mode: 'black'; payloadId: null; payload: null; pinned: boolean }
  | { mode: 'question' | 'results' | 'couple_reveal'; payloadId: string; payload: null; pinned: boolean }
  | { mode: 'tournament_bracket' | 'tournament_match' | 'champion'; payloadId: string | null; payload: null; pinned: boolean }
  | { mode: 'premiere_standby' | 'premiere_countdown' | 'premiere_playing'; payloadId: string | null; payload: Record<string, unknown> | null; pinned: true };
```

- [ ] **Step 5: Run DB/type tests**

Run: `supabase test db && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase src/features/screen/screen.types.ts src/features/screen/screen.service.ts
git commit -m "feat: add authoritative projector screen state"
```

---

### Task 2: Build resilient realtime screen subscription and connection recovery

**Files:**
- Create: `src/features/screen/useScreenState.ts`
- Create: `src/features/screen/useScreenState.test.tsx`
- Create: `src/features/screen/connection/connectionStore.ts`
- Create: `src/features/screen/connection/connectionStore.test.ts`
- Create: `src/features/screen/ScreenPage.tsx`
- Modify: `src/app/routes.tsx`

**Interfaces:**
- `useScreenState(eventId)` returns `{ state, connection: 'online' | 'reconnecting' | 'offline', lastUpdatedAt }`.
- Keeps the last valid screen snapshot when realtime disconnects.

- [ ] **Step 1: Write reducer/connection tests**

```ts
it('keeps the last valid screen state while reconnecting', () => {
  const online = reduceConnection(initial, { type: 'STATE', state: idleState });
  const reconnecting = reduceConnection(online, { type: 'DISCONNECTED' });
  expect(reconnecting.screenState).toEqual(idleState);
  expect(reconnecting.status).toBe('reconnecting');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/screen/connection src/features/screen/useScreenState.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement fetch-then-subscribe behavior**

On mount: fetch current public screen state, render it, then subscribe to event-state changes. On channel error/timeout, show a tiny degraded status indicator and retain the last valid presentation instead of replacing the whole screen with an error.

- [ ] **Step 4: Add automatic resubscription and visibility recovery**

When browser returns to foreground or `online` fires, refetch current authoritative state before resubscribing so missed realtime events do not leave stale presentation state.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/screen`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen src/app/routes.tsx
git commit -m "feat: add resilient realtime projector client"
```

---

### Task 3: Implement the animated idle QR screen

**Files:**
- Create: `src/features/screen/IdleScreen.tsx`
- Create: `src/features/screen/IdleScreen.test.tsx`
- Create: `src/features/screen/idleScreen.css`
- Create: `src/components/QrCodeCard.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`

**Interfaces:**
- `IdleScreen` props: `joinUrl`, `registeredCount`, `carriageCounts`, `connectionStatus`.
- QR container is a static DOM region with no transform animation.

- [ ] **Step 1: Write scanability/content tests**

```tsx
it('keeps a stable QR and fallback URL visible', () => {
  render(<IdleScreen joinUrl="https://example.test/go" registeredCount={27} carriageCounts={counts} connectionStatus="online" />);
  expect(screen.getByLabelText('QR регистрации гостей')).toBeInTheDocument();
  expect(screen.getByText('https://example.test/go')).toBeInTheDocument();
  expect(screen.getByText(/уже в составе: 27/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/screen/IdleScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement composition and CTA rotation**

Seed exactly these messages:

```ts
const idleMessages = [
  ['ДОБРО ПОЖАЛОВАТЬ В СОСТАВ', 'Наведите камеру на QR и получите свой билет'],
  ['ЕЩЁ НЕ В ВАГОНЕ?', 'Сканируйте QR — регистрация займёт меньше минуты'],
  ['ВАШ БИЛЕТ УЖЕ ЖДЁТ', 'Имя, фамилия — и вы в составе'],
] as const;
```

Use CSS opacity/translate for 6–10 second text transitions, slow light-field/route-line movement, and a reduced-motion media query. Do not animate the QR element itself.

- [ ] **Step 4: Add live aggregate carriage counts**

Show `В СОСТАВЕ УЖЕ N ПАССАЖИРОВ` and optional compact `Вагон 1 · 7` style counts without names or affiliation data.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/features/screen/IdleScreen.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen/IdleScreen* src/components/QrCodeCard.tsx
git commit -m "feat: add animated idle QR screen"
```

---

### Task 4: Add durable screen event queue and priority policy

**Files:**
- Modify: `supabase/migrations/002_screen_realtime_events.sql`
- Modify: `supabase/tests/screen_state.sql`
- Create: `src/features/screen/events/eventPriority.ts`
- Create: `src/features/screen/events/eventPriority.test.ts`
- Create: `src/features/screen/ScreenEventLayer.tsx`
- Create: `src/features/screen/ScreenEventLayer.test.tsx`
- Modify: `src/features/screen/screen.service.ts`

**Interfaces:**
- Table `screen_events(id,event_id,type,priority,payload,sound_key,status,created_at,shown_at,expires_at)`.
- `canPresentEvent(screenState, event): boolean`.
- Owner can clear/replay/custom-create; screen can only mark a currently claimed event shown through a constrained RPC.

- [ ] **Step 1: Write priority tests**

```ts
it.each(['premiere_countdown','premiere_playing','black'] as const)(
  'blocks ambient moments while screen mode is %s',
  mode => expect(canPresentEvent({ ...baseState, mode, pinned: true }, registrationEvent)).toBe(false),
);

it('allows registration moment during idle', () => {
  expect(canPresentEvent(idleState, registrationEvent)).toBe(true);
});
```

- [ ] **Step 2: Add DB queue tests**

Verify events transition `queued -> showing -> shown`, expired events are suppressed, and anonymous users cannot create/clear queue rows.

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- src/features/screen/events src/features/screen/ScreenEventLayer.test.tsx && supabase test db`
Expected: FAIL.

- [ ] **Step 4: Implement queue claim/render/complete flow**

The screen claims one eligible event at a time. It never renders two events simultaneously. Stale registration events missed during a disconnect must expire rather than replay minutes later. Low-value duplicate milestones may be coalesced before insertion.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/features/screen && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen supabase
git commit -m "feat: add prioritized projector event queue"
```

---

### Task 5: Build registration train moment and restrained audio system

**Files:**
- Create: `src/features/screen/RegistrationTrainMoment.tsx`
- Create: `src/features/screen/RegistrationTrainMoment.test.tsx`
- Create: `src/features/screen/registrationTrain.css`
- Create: `src/features/screen/audio/screenAudio.ts`
- Create: `src/features/screen/audio/screenAudio.test.ts`
- Add: `public/audio/train-chime.*` during asset-preparation implementation, sourced/licensed for the project rather than copied from copyrighted media.

**Interfaces:**
- Moment payload: `{ guestDisplayName: 'Иван П.', carriageNumber: 3, carriageLabel: 'ВАГОН №3', accentHex: '#7E3F3C' }`.
- `unlockScreenAudio(): Promise<boolean>` and `playScreenSound(key): Promise<void>`.

- [ ] **Step 1: Write privacy and fallback tests**

```tsx
it('shows abbreviated public identity and carriage number', () => {
  render(<RegistrationTrainMoment event={fixture} reducedMotion={false} />);
  expect(screen.getByText('Иван П.')).toBeInTheDocument();
  expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
  expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/screen/RegistrationTrainMoment.test.tsx src/features/screen/audio`
Expected: FAIL.

- [ ] **Step 3: Implement the 3–4 second editorial train scene**

Use a lightweight SVG/CSS train silhouette/linework with one carriage accent, controlled horizontal translate/opacity, no cartoon bounce and no overlap with the QR quiet zone. Reduced-motion mode uses an elegant fade/slide card with the same text.

- [ ] **Step 4: Implement audio unlock/mute behavior**

`playScreenSound` must silently no-op when sound is muted or audio is not armed; the visual moment must still finish normally. Registration sound preference is independent from other event sounds.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/screen`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen public/audio
git commit -m "feat: add registration train screen moment"
```

---

### Task 6: Add one-time projector connection gate and technical presence

**Files:**
- Create: `src/features/screen/ScreenConnectGate.tsx`
- Create: `src/features/screen/ScreenConnectGate.test.tsx`
- Modify: `supabase/migrations/002_screen_realtime_events.sql`
- Create: `src/features/admin/status/AdminTechnicalStatus.tsx`
- Create: `src/features/admin/status/AdminTechnicalStatus.test.tsx`

**Interfaces:**
- Projector reports heartbeat/presence plus `audioArmed` and later premiere `videoReady` flags.
- Admin technical status displays `Экран`, `Realtime/Интернет`, `Видео`, `Звук`, `Гостей онлайн/недавно активных`.

- [ ] **Step 1: Write connect-gate test**

```tsx
it('requires one local connect action before hiding setup controls', async () => {
  render(<ScreenConnectGate />);
  expect(screen.getByRole('button', { name: /подключить экран/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/screen/ScreenConnectGate.test.tsx src/features/admin/status`
Expected: FAIL.

- [ ] **Step 3: Implement connect action**

The button requests fullscreen when possible, calls `unlockScreenAudio()`, writes projector presence/preflight state and then shows the normal `/screen` renderer. Failure to enter fullscreen does not kill the screen; it shows a precise setup warning.

- [ ] **Step 4: Implement status strip**

Admin renders compact green/amber/red states without hiding controls. Presence expiry should turn `Экран: нет связи` after a short heartbeat grace period rather than pretending the screen is connected forever.

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npm test -- src/features/screen src/features/admin/status && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen src/features/admin/status supabase
git commit -m "feat: add projector arming and technical status"
```

---

### Task 7: Build owner screen controls, emergency actions, and event controls

**Files:**
- Create: `src/features/admin/screen/AdminScreenControls.tsx`
- Create: `src/features/admin/screen/AdminScreenControls.test.tsx`
- Create: `src/features/admin/screen/AdminScreenEvents.tsx`
- Create: `src/features/admin/screen/AdminScreenEvents.test.tsx`
- Modify: `src/features/admin/AdminShell.tsx`

**Interfaces:**
- Always-reachable actions: `ГЛАВНЫЙ QR`, `ЧЁРНЫЙ ЭКРАН`, `ОСТАНОВИТЬ ТЕКУЩИЙ РЕЖИМ`, `ВЕРНУТЬ ГЛАВНЫЙ ЭКРАН`.
- Event controls: auto events on/off, screen sounds on/off, registration sound on/off, queue count, clear queue, replay last, custom event, pin/unpin.

- [ ] **Step 1: Write emergency control tests**

```tsx
it('keeps black-screen control directly accessible', () => {
  render(<AdminScreenControls />);
  expect(screen.getByRole('button', { name: 'ЧЁРНЫЙ ЭКРАН' })).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/admin/screen`
Expected: FAIL.

- [ ] **Step 3: Implement emergency command group**

`ЧЁРНЫЙ ЭКРАН` acts immediately. Stop/reset actions that discard active state require confirmation. `ГЛАВНЫЙ QR` returns to `idle` without closing guest registration.

- [ ] **Step 4: Implement screen-event management**

Owner can clear queue, replay last shown event, send custom event text, pin/unpin screen, toggle automatic moments and sounds. All mutations use owner RPCs; no client-only trust.

- [ ] **Step 5: Run complete screen suite**

Run: `npm run typecheck && npm test -- src/features/screen src/features/admin/screen src/features/admin/status && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/screen src/features/admin/AdminShell.tsx
git commit -m "feat: add owner projector and event controls"
```

---

## Self-Review

- Spec coverage: idle animation/QR, QR fallback, screen priority, owner-only remote control, same-account laptop/phone, one-time audio/fullscreen arming, train registration animation, queued live moments, sound toggles, protected modes, emergency controls, connection resilience and technical status all have tasks.
- Placeholder scan: no implementation placeholders or undefined future actions remain inside this plan.
- Type consistency: `ScreenMode`, `ScreenState`, queue states and owner RPC boundary are used consistently.
- Deferred to module plans: exact quiz/result scenes, MK bracket/match/champion scenes and premiere countdown/video renderer provide their own content while consuming this screen infrastructure.
