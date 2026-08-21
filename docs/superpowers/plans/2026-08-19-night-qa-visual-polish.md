# Night QA and Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish automated verification, add the admin rehearsal launcher, and improve projector visuals without changing the existing event state machines.

**Architecture:** Keep all business state in existing Supabase RPC/realtime services. UI work is limited to presentation components and CSS. Protected-mode precedence remains Bunker → Premiere → MK → Quiz → ordinary events.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, Supabase/Postgres, CSS/SVG.

**Spec:** `docs/superpowers/specs/2026-08-19-night-qa-visual-polish-design.md`

## Global Constraints

- Work on `feat/admin-rehearsal-links`; do not modify `main` until verification is green.
- Preserve all current RPC names, routes and realtime channel contracts.
- Registration stays open for late guests unless explicitly closed by owner.
- Premiere countdown remains 10→1, never 0.
- Bunker remains the highest-priority projector state and holds at 00:00 until STOP.
- Reset preserves couple preanswers and premiere media configuration.
- Relative links must remain compatible with Lovable and a future `.ru` domain.

---

### Task 1: Finish CI/E2E infrastructure repair

**Files:**
- Modify: `e2e/global.setup.ts`
- Modify: `e2e/event-flow.spec.ts`
- Modify: `e2e/security.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/e2e.yml`
- Modify: `package.json`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `owner_get_dashboard`, `owner_create_event`, `owner_reset_event_test_data`
- Produces: clean hosted test path without direct privileged table setup

- [ ] Verify CI installs dependencies and reaches typecheck.
- [ ] Remove direct service-role reads/deletes of `events`/`guests` from E2E setup/specs.
- [ ] Use owner dashboard RPC for event/guest assertions.
- [ ] Run hosted CI and E2E; fix only root causes revealed by logs.

### Task 2: Admin rehearsal launcher

**Files:**
- Create: `src/features/admin/rehearsal/AdminRehearsalPanel.tsx`
- Create: `src/features/admin/rehearsal/AdminRehearsalPanel.test.tsx`
- Modify: `src/features/admin/AdminShell.tsx`
- Modify: `src/styles/admin.css`

**Interfaces:**
- Consumes: browser same-origin routing only
- Produces: five new-tab links `/screen`, `/join`, `/play`, `/mortal-kombat`, `/mortal-kombat/screen`

- [ ] Keep the failing five-link test.
- [ ] Implement the minimal panel with accessible labels and new-tab behavior.
- [ ] Render below admin header.
- [ ] Add compact mobile styling.
- [ ] Verify via unit suite and production build.

### Task 3: Cinematic train arrival scene

**Files:**
- Modify: existing train arrival presentation component located by `train-arrival-scene`
- Modify: associated screen CSS
- Modify/Create: focused train scene unit test

**Interfaces:**
- Consumes: existing registration `screen_event` payload and `screenAudio`
- Produces: same `data-testid="train-arrival-scene"`, passenger copy, ticket/carriage presentation

- [ ] Add/retain a failing presentation test requiring locomotive visual markers and passenger information.
- [ ] Implement a lightweight SVG/DOM train with locomotive, cars, track and steam/light accents.
- [ ] Animate only `transform`/`opacity` for moving train/track/steam.
- [ ] Preserve protected-mode unmount and `stopArrival()` behavior.
- [ ] Add `prefers-reduced-motion` fallback.
- [ ] Run unit tests and build.

### Task 4: Screen scene polish and animation collision audit

**Files:**
- Inspect/modify only existing projector scene components and styles as needed.
- Test: existing ScreenPage/Bunker/Premiere/MK tests plus focused regressions when behavior changes.

**Interfaces:**
- Consumes: existing ScreenPage scene precedence
- Produces: no new full-screen state machine

- [ ] Audit fixed/z-index layers and ensure no decorative layer exceeds protected-mode hierarchy.
- [ ] Add subtle idle rail ambience without blocking QR scanning.
- [ ] Ensure carriage call remains visually distinct from train arrival.
- [ ] Verify Bunker hides underlying video/MK/quiz and ordinary events.
- [ ] Verify Premiere suppresses ordinary arrivals/calls.

### Task 5: Scenario completeness audit

**Files:**
- Modify: `docs/event-day-checklist.md`
- Modify: `docs/test-rehearsal-results.md`
- Optionally add missing regression tests only for concrete gaps found.

**Interfaces:**
- Consumes: original event requirements in the spec
- Produces: one checklist mapping every agreed scenario to an implementation/test

- [ ] Confirm registration/late guest/composition lock behavior.
- [ ] Confirm carriage calls, quiz, couple answers, Final Five, MK, premiere, Bunker, reset and multi-TV presence.
- [ ] Confirm owner-only controls and anonymous security boundaries.
- [ ] Record any remaining manual-only venue/hardware checks.

### Task 6: Final verification and synchronization

**Files:**
- No production changes unless verification reveals a concrete defect.

**Interfaces:**
- Consumes: all prior tasks
- Produces: green feature branch ready for review/merge decision

- [ ] Hosted CI: install + typecheck + unit tests + build = PASS.
- [ ] Hosted E2E: local Supabase + Playwright multi-client flow = PASS.
- [ ] DB migrations 001→025 clean-install = PASS via local Supabase start.
- [ ] Confirm PR is mergeable and `main` remains unchanged.
- [ ] Confirm latest feature-branch contents are visible through GitHub/Lovable sync before asking user to publish/update production.

