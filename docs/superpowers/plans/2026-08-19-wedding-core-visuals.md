# Wedding Core Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the default wedding experience into a refined editorial + railway visual system, starting with the idle TV registration screen and the guest mobile ticket while preserving all existing registration and live-screen behavior.

**Architecture:** Keep all live state, registration data, routes, Supabase calls, scene priority, and QR behavior unchanged. Add presentation-only markup and a dedicated scoped stylesheet, plus one original inline-SVG railway emblem reused by the TV ticket and mobile ticket. Existing business components continue to consume the same props and types.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Testing Library, Playwright 1.62, qrcode.react 4.2, CSS/SVG.

**Spec:** `docs/superpowers/specs/2026-08-19-event-day-visual-system-design.md`

## Global Constraints

- Work only on `feat/event-day-visual-polish`; do not modify `main` until verification is green and the user approves merge.
- Preserve live scene priority exactly: Bunker → Premiere → MK when explicitly presented → Quiz/reveals → carriage call/train arrival → idle QR.
- Do not change registration payloads, `RegisteredGuest`, carriage allocation, reset semantics, owner permissions, or screen authority.
- Keep `/screen` free of owner mutation controls.
- Keep the QR large and unobstructed at 1920×1080.
- Keep guest-facing pages free of horizontal overflow at 390 px.
- Use only original CSS/SVG decoration; no copied reference artwork and no proprietary font files.
- Wedding-facing visuals are approximately 70% editorial wedding / 30% railway ephemera.
- Preserve `prefers-reduced-motion` behavior.
- The existing unimported `src/styles/event-day-polish.css` predates this approved visual direction and contains red/Bunker styling that conflicts with the new spec; it must not be imported. Remove it in this slice so it cannot be accidentally activated later.

---

### Task 1: Define the reusable wedding railway visual layer

**Files:**
- Create: `src/features/visual/WeddingRailwayEmblem.tsx`
- Create: `src/features/visual/WeddingRailwayEmblem.test.tsx`
- Create: `src/styles/wedding-editorial.css`
- Modify: `src/main.tsx`
- Delete: `src/styles/event-day-polish.css`

**Interfaces:**
- Produces: `WeddingRailwayEmblem({ className?: string }: { className?: string })`
- Produces: scoped CSS variables `--wedding-paper`, `--wedding-cream`, `--wedding-graphite`, `--wedding-forest`, `--wedding-blue-grey`, `--wedding-brass`, `--wedding-cinnamon`.
- Consumes: no runtime data and no external assets.

- [ ] **Step 1: Write the failing emblem test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeddingRailwayEmblem } from './WeddingRailwayEmblem';

describe('WeddingRailwayEmblem', () => {
  it('renders an original decorative railway mark without exposing interactive UI', () => {
    render(<WeddingRailwayEmblem className="test-emblem" />);
    const emblem = screen.getByTestId('wedding-railway-emblem');
    expect(emblem).toHaveClass('test-emblem');
    expect(emblem).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/features/visual/WeddingRailwayEmblem.test.tsx`

Expected: FAIL because `WeddingRailwayEmblem.tsx` does not exist.

- [ ] **Step 3: Implement the minimal original inline-SVG emblem**

```tsx
type WeddingRailwayEmblemProps = { className?: string };

export function WeddingRailwayEmblem({ className = '' }: WeddingRailwayEmblemProps) {
  return (
    <svg
      className={className}
      data-testid="wedding-railway-emblem"
      aria-hidden="true"
      viewBox="0 0 240 96"
      fill="none"
    >
      <path d="M18 69H221" stroke="currentColor" />
      <path d="M44 61H177L190 69H36L44 61Z" stroke="currentColor" />
      <rect x="71" y="34" width="74" height="27" rx="2" stroke="currentColor" />
      <path d="M83 34V24H105V34M119 34V18H132V34" stroke="currentColor" />
      <circle cx="68" cy="70" r="9" stroke="currentColor" />
      <circle cx="151" cy="70" r="9" stroke="currentColor" />
      <path d="M159 42H177L190 61H159V42Z" stroke="currentColor" />
      <path d="M93 44H108M116 44H131" stroke="currentColor" />
    </svg>
  );
}
```

- [ ] **Step 4: Add wedding visual tokens and import the stylesheet**

Add to `src/styles/wedding-editorial.css`:

```css
:root {
  --wedding-paper: #F3EEE5;
  --wedding-cream: #E9DFD0;
  --wedding-mist: #D9D2C7;
  --wedding-graphite: #252724;
  --wedding-forest: #31483A;
  --wedding-blue-grey: #9BA9B4;
  --wedding-brass: #A58C5B;
  --wedding-cinnamon: #9A6348;
}
```

Import it immediately after `./styles/globals.css` in `src/main.tsx`.

Delete `src/styles/event-day-polish.css` instead of importing it.

- [ ] **Step 5: Run focused test + typecheck**

Run: `npm test -- src/features/visual/WeddingRailwayEmblem.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/visual src/styles/wedding-editorial.css src/main.tsx src/styles/event-day-polish.css
git commit -m "feat: add wedding editorial visual foundation"
```

---

### Task 2: Turn the idle TV screen into a luxury railway wedding ticket

**Files:**
- Modify: `src/features/screen/IdleRegistrationScreen.test.tsx`
- Modify: `src/features/screen/IdleRegistrationScreen.tsx`
- Modify: `src/styles/wedding-editorial.css`

**Interfaces:**
- Consumes: unchanged `IdleRegistrationScreen({ joinUrl }: { joinUrl: string })`.
- Produces: same `data-testid="registration-qr"` and same `data-join-url`.
- Produces presentation anchors: `data-testid="idle-ticket-body"` and `data-testid="idle-ticket-stub"`.

- [ ] **Step 1: Extend the unit test and verify RED**

Add assertions:

```tsx
expect(screen.getByTestId('idle-ticket-body')).toBeInTheDocument();
expect(screen.getByTestId('idle-ticket-stub')).toBeInTheDocument();
expect(screen.getByText('TRAIN No. LV-830')).toBeInTheDocument();
expect(screen.getByTestId('wedding-railway-emblem')).toBeInTheDocument();
```

Run: `npm test -- src/features/screen/IdleRegistrationScreen.test.tsx`

Expected: FAIL because the ticket body/stub and emblem do not exist yet.

- [ ] **Step 2: Implement the ticket composition without changing QR behavior**

Restructure the content around this shape:

```tsx
<section className="idle-ticket">
  <div className="idle-ticket__body" data-testid="idle-ticket-body">
    <WeddingRailwayEmblem className="idle-ticket__locomotive" />
    {/* existing brand, date, headline, lead and route copy */}
  </div>
  <aside className="idle-ticket__stub" data-testid="idle-ticket-stub">
    <span className="idle-ticket__stub-label">TRAIN No. LV-830</span>
    <div className="idle-screen__qr-frame" data-testid="registration-qr" data-join-url={joinUrl}>
      <QRCodeSVG ... />
    </div>
    <p className="idle-screen__scan-label">НАВЕДИТЕ КАМЕРУ → ПОЛУЧИТЕ БИЛЕТ</p>
  </aside>
</section>
```

Do not rename the QR test id or alter `joinUrl`.

- [ ] **Step 3: Style the ticket as editorial-first / railway-second**

In `wedding-editorial.css` add only `.event-screen--idle`, `.idle-ticket*`, and existing `.idle-screen*` scoped rules. Required visual properties:

```css
.event-screen--idle {
  color: var(--wedding-graphite);
  background: var(--wedding-paper);
}

.idle-ticket {
  width: min(94vw, 112rem);
  min-height: min(76vh, 49rem);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(27rem, 0.36fr);
  border: 1px solid color-mix(in srgb, var(--wedding-graphite) 28%, transparent);
  background: linear-gradient(135deg, rgba(255,255,255,.34), transparent 35%), var(--wedding-paper);
  box-shadow: 0 2.5rem 7rem rgba(37,39,36,.10);
}

.idle-ticket__stub {
  position: relative;
  border-left: 1px dashed color-mix(in srgb, var(--wedding-graphite) 32%, transparent);
  background: color-mix(in srgb, var(--wedding-blue-grey) 18%, var(--wedding-paper));
}
```

Add a double inner rule, subtle perforation dots using CSS pseudo-elements, a date stamp, restrained `✦` separators, and slow paper-light/grain motion away from the QR.

- [ ] **Step 4: Add reduced-motion fallback**

```css
@media (prefers-reduced-motion: reduce) {
  .event-screen--idle *,
  .event-screen--idle *::before,
  .event-screen--idle *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- src/features/screen/IdleRegistrationScreen.test.tsx && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/screen/IdleRegistrationScreen.tsx src/features/screen/IdleRegistrationScreen.test.tsx src/styles/wedding-editorial.css
git commit -m "feat: redesign idle screen as railway wedding ticket"
```

---

### Task 3: Redesign the guest mobile ticket and soften the registration shell

**Files:**
- Modify: `src/features/registration/RegistrationPage.test.tsx`
- Modify: `src/features/registration/VirtualTicket.tsx`
- Modify: `src/styles/wedding-editorial.css`

**Interfaces:**
- Consumes: unchanged `RegisteredGuest` shape from `registration.types.ts`.
- Produces: same accessible ticket label, passenger name, carriage label, carriage visual mark and `ticketNumber`.
- Produces presentation anchor: `data-testid="virtual-ticket-stub"`.

- [ ] **Step 1: Extend the restored-ticket test and verify RED**

Add:

```tsx
expect(screen.getByTestId('virtual-ticket')).toBeInTheDocument();
expect(screen.getByTestId('virtual-ticket-stub')).toBeInTheDocument();
expect(screen.getByText('PASSENGER')).toBeInTheDocument();
expect(screen.getByText('VALID · 30 AUG 2026')).toBeInTheDocument();
expect(screen.getByTestId('wedding-railway-emblem')).toBeInTheDocument();
```

Run: `npm test -- src/features/registration/RegistrationPage.test.tsx`

Expected: FAIL on the new structural/copy assertions.

- [ ] **Step 2: Implement the collectible ticket markup**

Keep the existing article and data binding, but split it into main body + detachable stub:

```tsx
<article className="virtual-ticket" data-testid="virtual-ticket" ...>
  <div className="virtual-ticket__main">
    <div className="virtual-ticket__topline">...</div>
    <WeddingRailwayEmblem className="virtual-ticket__locomotive" />
    <span className="virtual-ticket__field-label">PASSENGER</span>
    <h2>{guest.firstName} {guest.lastName}</h2>
    <div className="virtual-ticket__carriage">...</div>
  </div>
  <aside className="virtual-ticket__stub" data-testid="virtual-ticket-stub">
    <span>VALID · 30 AUG 2026</span>
    <strong>{guest.ticketNumber}</strong>
    <span>{guest.carriage.label}</span>
    <span>{guest.carriage.visualMark}</span>
  </aside>
</article>
```

No new data fields may be added to `RegisteredGuest`.

- [ ] **Step 3: Style the mobile ticket and registration shell**

Use ivory stock, engraved/double rules, carriage color only as a small accent, a perforated edge, stamp/serial microcopy, and the original locomotive emblem. At `max-width: 520px`, stack the stub beneath the main body while keeping name, carriage and ticket number visible without horizontal scrolling.

Also visually align `.registration-card`, `.registration-routing`, and `.registration-success` to the new wedding palette without changing form controls, validation, duplicate handling, or submit behavior.

- [ ] **Step 4: Run registration tests**

Run: `npm test -- src/features/registration/RegistrationPage.test.tsx src/features/registration/GuestJoinPage.test.tsx src/features/registration/JoinPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/VirtualTicket.tsx src/features/registration/RegistrationPage.test.tsx src/styles/wedding-editorial.css
git commit -m "feat: redesign guest ticket as wedding railway ephemera"
```

---

### Task 4: Lock responsive safety and run the full regression suite

**Files:**
- Modify: `e2e/device-layout.spec.ts`
- No production files unless the test reveals a concrete layout defect.

**Interfaces:**
- Consumes: `/screen`, `/join`, existing local Supabase E2E setup.
- Produces: explicit 1920×1080 QR safety and 390×844 mobile ticket safety coverage.

- [ ] **Step 1: Strengthen the TV test**

Keep the existing bounding-box assertions and add a practical minimum QR size:

```ts
expect(qrBox!.width).toBeGreaterThanOrEqual(320);
expect(qrBox!.height).toBeGreaterThanOrEqual(320);
```

- [ ] **Step 2: Add a 390×844 guest registration/ticket layout test**

Register a guest through `/join` using the existing local test backend, wait for `virtual-ticket`, then:

```ts
await expect(page.getByTestId('virtual-ticket')).toBeVisible();
await expect(page.getByTestId('virtual-ticket-stub')).toBeVisible();
await expectNoHorizontalOverflow(page);
```

The test should assert passenger name, carriage label and ticket number remain visible.

- [ ] **Step 3: Run device-layout E2E**

Run: `npm run e2e -- e2e/device-layout.spec.ts`

Expected: PASS on 390×844 and 1920×1080.

- [ ] **Step 4: Run the full verification matrix**

Run:

```bash
npm run typecheck
npm test
npm run build
npm run e2e
```

Expected: all PASS; no change in the existing 10 multi-client live-flow/security behaviors except the new visual-layout coverage increasing the E2E count.

- [ ] **Step 5: Review scope before PR**

Confirm the diff contains no changes to Supabase migrations/services, screen authority, Bunker, Premiere, MK logic, carriage allocation, owner RPCs, or reset semantics.

- [ ] **Step 6: Commit**

```bash
git add e2e/device-layout.spec.ts
git commit -m "test: verify wedding visual layouts on phone and TV"
```

---

## Self-Review Results

- Spec coverage for rollout slice 1: shared wedding tokens, idle TV ticket, mobile guest ticket, original railway illustration, mobile/TV verification — covered.
- No business/data interface changes are planned.
- The stale `event-day-polish.css` conflicts with the approved monochrome Bunker direction and is explicitly removed rather than imported.
- No proprietary font or copied reference asset is required.
- Train arrival, quiz/reveals, MK, Bunker, and Premiere remain out of this first implementation slice and will receive separate plans after this slice is green.
