# Live Runtime + Mobile Hardening Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-21-live-runtime-mobile-hardening.md`

1. **Owner auth and reset semantics**
   - Add RED tests for opaque publishable-key handling, session-expiry UI, local sign-out, and reset-success/refresh-failure separation.
   - Unify the production Supabase client and subscribe AdminPage to auth changes.
   - Add mobile owner status/sign-out treatment.

2. **Tournament for 2–40 players**
   - Add RED bracket/parser/UI and SQL contract tests for 2, 9, 16, 17, and 40 players.
   - Add a forward-only migration for the deterministic 64-slot tree and update round types, parsers, labels, and owner gating.
   - Preserve virtual idle state and explicit 0/1 preparation; never auto-open existing events.

3. **Bunker launch diagnostics and progression**
   - Add RED tests for named prepare/distribute/start failures and successful projector handoff.
   - Preserve committed command results when broadcast/reload fails and safely expose RPC code/message.
   - Present `global_game_state` as authoritative in the owner panel.

4. **Guest priority and LIVE QUIZ mobile redesign**
   - Add RED DOM-order, 390 px interaction, and deleted-guest revalidation tests.
   - Move the current event above the ticket, refine the editorial railway quiz card, and keep transient offline data.

5. **Mobile admin navigation**
   - Add RED accessibility/structure tests for section anchors and 44 px mobile controls.
   - Add a compact sticky operations index and safe-area layout without changing command semantics.

6. **Release verification and synchronization**
   - Request independent scoped reviews.
   - Run focused suites, full Vitest, typecheck, build, and diff checks.
   - Apply reviewed forward-only migrations, run Supabase security/performance advisors, commit, push `main`, wait for Lovable, publish, and recheck live routes.

7. **Projector event train and resilient delivery**
   - Present every `guest_registered` event as one real RGBA locomotive-and-four-carriage composition moving right to left.
   - Mount the event type, guest name, assigned carriage, and boarding date directly on the four carriage panels; keep an accessible live announcement outside the decorative rig.
   - Start the recorded `arrival.sequence` before the 1.25 s train entrance, keep the scene for 14 s, and stop/fade the cue when the train leaves.
   - Recover missed screen events through Realtime subscription status, 1.5 s catch-up polling, visibility/focus recovery, and online recovery with event-id deduplication.

8. **Matching event scenes and guest inventory**
   - Rework carriage-call and LIVE QUIZ answer/result transitions in the same paper-and-railway visual language using real assets.
   - Keep `СЕЙЧАС ПРОИСХОДИТ` above the ticket in GuestHub.
   - Show an explicit empty inventory before Bunker starts; replace it with authoritative Bunker inventory when the runtime becomes active.

9. **Final visual and production verification**
   - Run a separate visual QA pass for desktop projector, reduced motion, and 390 px guest/admin layouts.
   - Repeat the full release gate after all screen changes settle.
   - Apply only reviewed forward-only migrations, then commit, push to GitHub `main`, wait for Lovable synchronization, publish, and smoke-check live routes.
