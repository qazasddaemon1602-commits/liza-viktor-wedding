# Premiere, Resilience & Final QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the wedding-track premiere with manual readiness/quorum guidance, synchronized 10→1 countdown with restrained sound, reliable video playback, late-arrival continuity, asset/network resilience, and full-event integration QA.

**Architecture:** Premiere state is server-authoritative for orchestration but media playback is owned by the preflighted laptop. The owner schedules one future `premiere_start_at` timestamp; the projector derives the countdown locally and starts the already-preloaded video exactly at that boundary. Registration and all later modules remain independent, so the premiere can happen when the main body has arrived without blocking late guests.

**Tech Stack:** React, TypeScript, Supabase PostgreSQL/Realtime/Storage, HTMLVideoElement, Web Audio/HTMLAudio, PWA/service worker asset caching, Vitest, Testing Library, Playwright for multi-client event QA.

## Global Constraints

- Source premiere asset: `КОЛЬЦО.mp4`, 10:23 / 623 s, 1920×1080, 30 fps, H.264 video, AAC audio, approximately 263 MB.
- Do **not** commit the source video to GitHub; store in Supabase Storage or equivalent deploy-safe media/CDN.
- Premiere is manually launched by the owner; never auto-start from guest-count heuristics.
- Readiness indicator is advisory: expected guest count initially ~40, substantial majority threshold configurable, recent-arrival quiet period, projector/video/audio preflight green.
- Registration remains open after premiere unless owner explicitly closes it.
- `ЗАФИКСИРОВАТЬ СОСТАВ` freezes existing carriage assignments but does not block late arrivals.
- Countdown sequence is exactly `10 → 9 → ... → 1`; never render `0`; video begins immediately after `1`.
- Countdown sound is a restrained low pulse/tick, with slightly more tension on `3,2,1`; no train horn and no sound between `1` and video start.
- Premiere countdown/playback are protected screen modes and suppress all automatic screen-event sounds/animations.
- Projector should preserve last valid display during temporary network loss; full offline voting is not required.

---

## File Structure

- `supabase/migrations/005_premiere.sql` — media metadata, premiere state, readiness settings, protected owner RPCs.
- `supabase/tests/premiere.sql` — launch/preflight/security/timestamp tests.
- `src/features/premiere/premiere.types.ts` — media/preflight/countdown types.
- `src/features/premiere/premiere.service.ts` — owner/read-only premiere API.
- `src/features/premiere/countdown.ts` — pure countdown derivation.
- `src/features/premiere/countdown.test.ts` — 10→1/no-zero timing tests.
- `src/features/premiere/PremierePlayer.tsx` — hidden/preloaded/fullscreen video renderer.
- `src/features/premiere/PremiereCountdown.tsx` — cinematic countdown.
- `src/features/premiere/premiereAudio.ts` — tick/pulse cue scheduling.
- `src/features/admin/premiere/AdminPremiereControl.tsx` — preflight/readiness/manual controls.
- `src/features/admin/premiere/PremiereReadiness.tsx` — advisory quorum state.
- `src/features/screen/premiere/PremiereStandbyScreen.tsx` — black/preload state.
- `src/features/screen/premiere/PremiereScreen.tsx` — countdown/player/end-state orchestration.
- `src/pwa/registerServiceWorker.ts` — app-shell cache registration.
- `vite.config.ts` — PWA/cache configuration.
- `e2e/event-flow.spec.ts` — multi-client happy path and late-arrival flow.
- `e2e/security.spec.ts` — route/mutation boundary smoke tests.

---

### Task 1: Create premiere schema, media metadata and owner-only orchestration

**Files:**
- Create: `supabase/migrations/005_premiere.sql`
- Create: `supabase/tests/premiere.sql`
- Create: `src/features/premiere/premiere.types.ts`
- Create: `src/features/premiere/premiere.service.ts`

**Interfaces:**
- Tables/fields: `media_items`, premiere columns in `event_state`, event readiness settings.
- Owner RPCs: `owner_prepare_premiere`, `owner_schedule_premiere`, `owner_cancel_premiere`, `owner_pause_premiere`, `owner_resume_premiere`, `owner_restart_premiere`, `owner_finish_premiere`.
- Public screen can read only safe media URL/metadata required for playback while owner controls mutation.

- [ ] **Step 1: Write DB security/preflight tests**

```sql
begin;
select plan(4);
select has_table('public', 'media_items', 'media table exists');
select function_returns('public', 'owner_schedule_premiere', ARRAY['uuid','timestamptz'], 'jsonb', 'schedule rpc exists');
select throws_ok($$ select public.owner_schedule_premiere(gen_random_uuid(), now() + interval '10 seconds') $$, '42501', null, 'anonymous cannot launch premiere');
select isnt_empty($$ select 1 from information_schema.columns where table_name='event_state' and column_name='premiere_start_at' $$, 'premiere timestamp exists');
select * from finish();
rollback;
```

- [ ] **Step 2: Run and verify failure**

Run: `supabase db reset && supabase test db`
Expected: FAIL.

- [ ] **Step 3: Implement media and premiere state**

Store metadata only: storage path, title, duration `623`, enabled flag. Premiere state includes `premiere_status`, `premiere_start_at`, `premiere_position_seconds`, `premiere_media_id`, `premiere_end_mode`.

`owner_schedule_premiere` rejects launch unless projector presence, audio armed and video ready flags are all current/green. It writes `premiere_start_at = requested timestamp`, `screen_mode='premiere_countdown'`, `screen_pinned=true` and an action-log row in one transaction.

- [ ] **Step 4: Run DB tests**

Run: `supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase src/features/premiere/premiere.types.ts src/features/premiere/premiere.service.ts
git commit -m "feat: add secure premiere orchestration"
```

---

### Task 2: Implement exact synchronized 10→1 countdown logic

**Files:**
- Create: `src/features/premiere/countdown.ts`
- Create: `src/features/premiere/countdown.test.ts`
- Create: `src/features/premiere/PremiereCountdown.tsx`
- Create: `src/features/premiere/PremiereCountdown.test.tsx`

**Interfaces:**
- `getCountdownFrame(nowMs, startMs): { number: 10|9|8|7|6|5|4|3|2|1|null; shouldPlay: boolean }`.
- `shouldPlay` becomes true at/after `startMs`; `number` is never zero.

- [ ] **Step 1: Write timing tests**

```ts
it('shows 10 at the beginning of a 10 second countdown', () => {
  expect(getCountdownFrame(0, 10_000)).toEqual({ number: 10, shouldPlay: false });
});

it('shows 1 during the final second and then plays with no zero frame', () => {
  expect(getCountdownFrame(9_100, 10_000)).toEqual({ number: 1, shouldPlay: false });
  expect(getCountdownFrame(10_000, 10_000)).toEqual({ number: null, shouldPlay: true });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/premiere/countdown.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement timestamp-derived logic**

Use `Math.ceil((startMs - nowMs) / 1000)` clamped to 1…10 while positive. Do not decrement local state with ten realtime events.

- [ ] **Step 4: Build cinematic visual component**

Near-black background, giant centered warm-ivory number, subtle scale/fade pulse, optional thin progress line/ring, caption `ПРЕМЬЕРА ЧЕРЕЗ`. Last 3 seconds may intensify slightly without flashing.

- [ ] **Step 5: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/premiere/countdown* src/features/premiere/PremiereCountdown.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/premiere/countdown* src/features/premiere/PremiereCountdown*
git commit -m "feat: add synchronized 10-to-1 premiere countdown"
```

---

### Task 3: Add countdown audio and protected media playback

**Files:**
- Create: `src/features/premiere/premiereAudio.ts`
- Create: `src/features/premiere/premiereAudio.test.ts`
- Create: `src/features/premiere/PremierePlayer.tsx`
- Create: `src/features/premiere/PremierePlayer.test.tsx`
- Create: `src/features/screen/premiere/PremiereStandbyScreen.tsx`
- Create: `src/features/screen/premiere/PremiereScreen.tsx`
- Modify: `src/features/screen/ScreenPage.tsx`

**Interfaces:**
- `playCountdownTick(second)` uses restrained pulse; `3,2,1` may use an alternate slightly stronger cue.
- Player preloads media before public countdown and calls `video.play()` at authoritative start timestamp.

- [ ] **Step 1: Write audio rules tests**

```ts
it('never schedules a countdown cue for zero', () => {
  expect(getCountdownCue(0)).toBeNull();
});

it('uses stronger but still restrained cue for final three seconds', () => {
  expect(getCountdownCue(3)).toBe('countdown-final');
  expect(getCountdownCue(4)).toBe('countdown-tick');
});
```

- [ ] **Step 2: Write player start test**

Mock `HTMLMediaElement.play` and assert it is invoked once when derived `shouldPlay` flips true, not on every render/realtime update.

- [ ] **Step 3: Run and verify failure**

Run: `npm test -- src/features/premiere`
Expected: FAIL.

- [ ] **Step 4: Implement preloading and playback**

Standby screen is black/near-black and preloads the selected video. Playback controls stay hidden. Countdown overlays the preloaded player; after `1`, overlay disappears and playback begins immediately. No registration/event sounds are allowed while premiere mode is protected.

- [ ] **Step 5: Implement end state**

On `ended`, report finish to server and hold a dark final frame until owner chooses `ГЛАВНЫЙ ЭКРАН`; returning to idle re-enables QR/late registration moments.

- [ ] **Step 6: Run tests/typecheck**

Run: `npm run typecheck && npm test -- src/features/premiere src/features/screen/premiere`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/premiere src/features/screen/premiere src/features/screen/ScreenPage.tsx
git commit -m "feat: add protected premiere playback and sound"
```

---

### Task 4: Build owner preflight, soft guest-quorum readiness and premiere controls

**Files:**
- Create: `src/features/admin/premiere/AdminPremiereControl.tsx`
- Create: `src/features/admin/premiere/AdminPremiereControl.test.tsx`
- Create: `src/features/admin/premiere/PremiereReadiness.tsx`
- Create: `src/features/admin/premiere/PremiereReadiness.test.tsx`
- Modify: `src/features/admin/AdminShell.tsx`
- Modify: `supabase/migrations/005_premiere.sql`

**Interfaces:**
- Readiness inputs: expected guest count, registered count, minutes since last registration, projector connected, video ready, audio armed.
- Advisory states only: `waiting`, `main_group_ready`, `technical_not_ready`, `ready`.
- Controls: `ПОДГОТОВИТЬ ПРЕМЬЕРУ`, `НАЧАТЬ ПРЕМЬЕРУ`, `ОТМЕНИТЬ ОТСЧЁТ`, pause/resume/restart, return to main screen.

- [ ] **Step 1: Write readiness heuristic tests**

```ts
it('can recommend the main group without requiring 40 of 40', () => {
  expect(getPremiereReadiness({ expected: 40, registered: 32, quietMinutes: 7, projector: true, video: true, audio: true }).mainGroupReady).toBe(true);
});

it('never indicates launch is automatic', () => {
  expect(getPremiereReadiness(readyFixture).autoStart).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/admin/premiere`
Expected: FAIL.

- [ ] **Step 3: Implement readiness display**

Show examples: `Зарегистрировано: 32 / ~40`, `Последний гость: 7 мин назад`, `Основной состав собран`, `Премьера готова`. Threshold and quiet-period values are owner-configurable settings, but launch button remains explicit/manual.

- [ ] **Step 4: Implement owner controls**

`НАЧАТЬ ПРЕМЬЕРУ` schedules a timestamp ~10 seconds in the future only after server preflight passes. `ОТМЕНИТЬ ОТСЧЁТ` works before playback. Pause/resume/restart/seek use owner state commands after playback begins.

- [ ] **Step 5: Run tests**

Run: `npm run typecheck && npm test -- src/features/admin/premiere && supabase test db`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/premiere src/features/admin/AdminShell.tsx supabase
git commit -m "feat: add owner premiere preflight and readiness"
```

---

### Task 5: Add app-shell caching and reconnect resilience

**Files:**
- Create: `src/pwa/registerServiceWorker.ts`
- Create: `src/pwa/cachePolicy.test.ts`
- Modify: `src/main.tsx`
- Modify: `vite.config.ts`
- Modify: `src/features/screen/useScreenState.ts`
- Modify: `src/features/admin/status/AdminTechnicalStatus.tsx`

**Interfaces:**
- Cache app shell, local fonts/icons, CSS, essential static question illustrations when practical; do not promise full offline server mutations.
- Premiere video is preflighted/buffered separately; source is not blindly placed in a generic service-worker precache.

- [ ] **Step 1: Write cache-policy test**

```ts
it('does not precache the 263MB premiere source video', () => {
  expect(PRECACHE_PATTERNS.some(pattern => String(pattern).includes('КОЛЬЦО.mp4'))).toBe(false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/pwa/cachePolicy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Configure PWA/app-shell cache**

Cache hashed JS/CSS, icons, local font files and lightweight static media. Network-first/revalidate event data. Projector retains last in-memory/locally persisted safe screen snapshot during temporary disconnection and refetches authoritative state on reconnect.

- [ ] **Step 4: Surface degraded state without breaking presentation**

Admin shows `Realtime: переподключение`; projector uses a tiny unobtrusive indicator. Do not blank or navigate away from the last valid screen.

- [ ] **Step 5: Run tests/build**

Run: `npm run typecheck && npm test -- src/pwa src/features/screen src/features/admin/status && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pwa src/main.tsx vite.config.ts src/features/screen src/features/admin/status
git commit -m "feat: add event presentation resilience"
```

---

### Task 6: Add multi-client end-to-end event flow tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/event-flow.spec.ts`
- Create: `e2e/security.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Test personas: owner phone, owner laptop `/screen`, guest A, late guest B, Liza, Viktor.
- Use seeded local Supabase fixture/event.

- [ ] **Step 1: Write registration/projector scenario**

```ts
test('guest registration updates owner and queues train moment on idle screen', async ({ browser }) => {
  // open owner admin + projector contexts, register guest, assert owner list/toast and idle-screen passenger moment
});
```

- [ ] **Step 2: Write late-arrival scenario**

Start/finish premiere, return projector to idle, register a new guest, assert existing carriage assignments remain unchanged and late guest receives normal ticket/current future participation.

- [ ] **Step 3: Write protected-mode scenario**

Register a guest during premiere countdown and assert the registration event is queued/suppressed rather than interrupting countdown/video; after return to idle, only non-expired eligible events display.

- [ ] **Step 4: Write security smoke tests**

Anonymous/Liza/Viktor cannot access owner mutation endpoints; `/screen` has no mutation controls; full guest list cannot be enumerated publicly.

- [ ] **Step 5: Run E2E suite**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add e2e playwright.config.ts package.json
git commit -m "test: cover multi-client wedding event flow"
```

---

### Task 7: Perform final event-day acceptance rehearsal

**Files:**
- Create: `docs/event-day-checklist.md`
- Create: `docs/test-rehearsal-results.md`

**Interfaces:**
- Produces a concrete rehearsal checklist and recorded pass/fail evidence before 30 August 2026.

- [ ] **Step 1: Write the operational checklist**

Checklist must include: owner login on phone/laptop, `/screen` fullscreen/audio arming, Supabase connection, QR scan from room distance, five carriage colors/labels, 40 simulated registrations, duplicate deletion/recovery, composition lock + late guest, carriage calls, quiz hidden-answer validation, final-five isolation, 16-player MK bracket/correction, video preflight, countdown sound, exact `10…1 -> video`, post-premiere QR return, black-screen emergency action and temporary network disconnect/reconnect.

- [ ] **Step 2: Run full automated suite**

Run: `npm run typecheck && npm test && supabase test db && npm run build && npm run e2e`
Expected: all PASS.

- [ ] **Step 3: Rehearse on real hardware**

Use the actual laptop, TV/projector connection, audio output and at least two real phones. Record pass/fail in `docs/test-rehearsal-results.md`, including actual venue-network test if available.

- [ ] **Step 4: Verify media behavior**

Confirm the production-hosted premiere media can buffer sufficiently from the venue connection; if not, deploy an optimized web delivery copy while retaining the supplied source as master outside GitHub.

- [ ] **Step 5: Commit rehearsal documentation**

```bash
git add docs/event-day-checklist.md docs/test-rehearsal-results.md
git commit -m "docs: add wedding event rehearsal checklist"
```

---

## Self-Review

- Spec coverage: manual premiere, majority/quorum guidance, late arrivals, 10→1/no zero, countdown sound, protected screen priority, video storage/preflight, pause/restart/end state, post-premiere registration, resilience and final rehearsal all have tasks.
- Placeholder scan: no TODO/TBD or unspecified test step remains.
- Type consistency: countdown timestamp, premiere states and readiness inputs match the shared screen-state architecture.
- Scope boundary: this plan integrates earlier registration, screen, quiz and MK plans but does not duplicate their business logic.
