# Bunker Wedding Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task by task.

**Goal:** Make the six-stage Bunker experience readable, obvious, warm, and wedding-oriented on phones and the projector while preserving all six missions, existing server contracts, Liza's active phrases/choices, and admin recovery controls.

**Architecture:** Keep Supabase/RPC state and mission identifiers unchanged. Simplify only the React presentation layer, progressive disclosure, audio ownership, and visual treatment. Each mission exposes one primary action and moves optional evidence, abilities, history, trades, and counters behind secondary disclosure. Existing realtime state remains authoritative.

**Tech Stack:** React 18, TypeScript, Vite, Vitest/Testing Library, Supabase Realtime/RPC, CSS, deterministic Node-generated PCM WAV assets.

**Spec:** `docs/superpowers/specs/2026-08-25-bunker-wedding-accessibility-design.md`

## Global Constraints

- Publish only through the repository and GitHub branch connected to Lovable; never edit Lovable directly.
- Do not add database states, migrations, mission identifiers, or new game mechanics.
- Preserve all six missions and their existing backend payloads/RPC commands.
- Preserve Liza's active choices and phrases in M2, M4, M6, and the finale; timeout fallback may remain, but must never replace her normal interaction.
- Preserve owner/admin recovery actions and idempotency.
- Mobile body text is at least 18px, important text 20px, bottom navigation at least 16px and 58-64px tall, primary touch targets at least 56px, radio controls at least 24px.
- Projector secondary copy is at least 18px and primary instructions 22-24px, with warm high-contrast paper/champagne surfaces.
- Use only project-owned generated music and already-attributed local cues; do not use unknown-provenance radio files or recognizable melodies.
- Keep Viktor and Liza fully visible in wedding imagery; preserve the existing blurred-fill treatment for nonmatching aspect ratios.
- Every behavior change starts with a focused failing test, followed by the smallest implementation and a focused green test.

## Task 1: Shared guided-player shell and accessibility foundation

**Files:**
- Modify: `src/features/bunker/v2/BunkerPlayerDashboard.tsx`
- Modify: `src/styles/bunker-accessibility.css`
- Modify: `src/styles/bunker-player.css`
- Modify: `src/styles/bunker-quest.css`
- Test: the existing `BunkerPlayerDashboard` test beside the component
- Test: add/update the most specific CSS contract test under `src/styles/`

**Steps:**
1. Add a failing dashboard test proving the current mission is the first visible/announced area, the bottom navigation remains available, and secondary panels are not expanded by default.
2. Add failing CSS contract assertions for 18px mobile copy, 56px primary targets, 24px radios, and 58-64px navigation with at least 16px labels.
3. Run only those tests and capture the expected failures in the task report.
4. Implement a reusable guided content structure using existing components/classes: one mission heading, one concise instruction, one primary action region, and collapsed secondary disclosure. Do not create a new application state.
5. Apply focus-visible styling for both light and dark surfaces and `prefers-reduced-motion` fallbacks.
6. Re-run focused tests and report the exact command/output.

## Task 2: Simplify Missions 1-3 without changing contracts

**Files:**
- Modify: `src/features/bunker/v2/MissionOnePlayer.tsx`
- Modify: `src/features/bunker/v2/MissionTwoPlayer.tsx`
- Modify: `src/features/bunker/v2/MissionThreePlayer.tsx`
- Modify: corresponding `.test.tsx` files

**Steps:**
1. M1 RED: assert selected guest names and quota are visible, a single confirmation sends the existing payload, and no second confirmation modal exists.
2. M1 GREEN: present the reserve-carriage story in a collapsed briefing, keep exact quota validation, and submit through the existing command once.
3. M2 RED: assert one question is shown at a time, a confirmed answer advances to the next question, evidence is available through a hint drawer, and Liza-dependent state remains visible when applicable.
4. M2 GREEN: implement client-only sequential presentation for the existing three answers; keep attempts/abilities secondary and preserve the existing submission payload.
5. M3 RED: assert the captain sees the main choice, other players see a passive discussion/waiting state, unavailable problems are visibly disabled, and abilities are secondary.
6. M3 GREEN: implement those roles using existing wagon/operator data and the existing command.
7. Run the three focused test files; do not alter Supabase migrations or generated types.

## Task 3: Simplify Missions 4-6 and preserve Liza interaction

**Files:**
- Modify: `src/features/bunker/v2/MissionFourPlayer.tsx`
- Modify: `src/features/bunker/v2/MissionFivePlayer.tsx`
- Modify: `src/features/bunker/v2/MissionSixPlayer.tsx`
- Modify: corresponding `.test.tsx` files
- Modify only if required for regression coverage: the existing operator/Liza tests

**Steps:**
1. M4 RED: assert the communicator sees three prepared valid messages, each containing `04` and at least one accepted term (`сектор`, `тоннель`, or `маршрут`); selecting one uses the existing message command; trades, free text, and history are secondary; Liza's normal choice remains active.
2. M4 GREEN: implement the prepared-message path without changing backend validation or answer payload.
3. M5 RED/GREEN: expose exactly two large primary choices, keep majority/frozen-member semantics, hide live totals and abilities from the primary path, and clearly show the accepted/waiting state.
4. M6 RED: assert the existing idempotent fragment reveal command runs once on first mission open, then the player sees the A/B/C question and a stable selected/accepted state; no manual “reveal fragment” button remains.
5. M6 GREEN: call the existing command behind a once-per-mission guard; keep counters/abilities secondary.
6. Add or retain regression assertions that Liza can act at M2, M4, M6, and FINAL_30 and that timeout fallback does not pre-empt her.
7. Run all focused M4-M6 and Liza operator tests.

## Task 4: Convert final access form to a guided five-step flow

**Files:**
- Modify: `src/features/bunker/v2/FinalPlayer.tsx`
- Modify: `src/features/bunker/v2/FinalPlayer.test.tsx`

**Steps:**
1. Add failing tests proving only one of the five existing inputs is primary at a time, Back/Continue navigation preserves entered values, review shows all five values, and final submit calls the existing `request_access` path exactly once with the unchanged payload shape.
2. Add failing tests for clear incorrect/accepted feedback and owner recovery copy when the normal operator path is unavailable.
3. Implement local step navigation only; do not persist new state and do not change the final RPC.
4. Ensure Liza's finale phrase/choice is still rendered through the existing operator flow, not replaced by automation.
5. Run the focused final-player and Liza finale tests.

## Task 5: Warm wedding projector treatment and readable finale

**Files:**
- Modify: `src/styles/bunker-v2-projector.css`
- Modify: `src/styles/bunker-projector-contrast.css`
- Modify: `src/styles/bunker-wedding-theme.css`
- Modify: `src/features/bunker/v2/BunkerEmergencyScene.tsx`
- Modify: `src/features/bunker/v2/operator/LizaRevealScreen.tsx`
- Modify: `src/features/bunker/v2/BunkerScreenGuard.tsx` only for presentation/transition ownership
- Modify: corresponding CSS/component tests

**Steps:**
1. Add failing contract/component tests for projector font minimums, warm high-contrast mission surfaces, reduced blackout/glitch, full Liza/Viktor image visibility, and preserved blurred-fill finale backdrop.
2. Replace dominant black/gray mission surfaces with warm paper/champagne panels while retaining the railway visual identity and readable dark text.
3. Replace harsh glitch/blackout transitions with a warm short crossfade and honor reduced motion.
4. Make Viktor imagery larger without face cropping; make Liza's reveal warm and uncropped; keep final image `contain` over the existing blurred cover layer.
5. Keep all functional screen states and admin recovery controls unchanged.
6. Run focused component and CSS contract tests.

## Task 6: Generate and register original mission/finale music

**Files:**
- Modify: `scripts/generate-audio-assets.mjs`
- Modify: `src/lib/audioManifest.ts`
- Modify: `src/lib/audioManifest.test.ts`
- Modify: `src/lib/bunkerAudio.ts`
- Modify: `src/lib/bunkerAudio.sample.test.ts`
- Modify: `public/audio/ATTRIBUTION.md`
- Generate: `public/audio/bunker/ambience.wav`
- Generate: `public/audio/bunker/finale.wav`

**Steps:**
1. Add failing manifest/audio tests for a project-owned looping “train waltz” mission cue and a distinct project-owned 40-50 second finale cue, both without vocal or external attribution.
2. Extend the deterministic generator with an original triple-meter light mission composition and a warm 40-50 second finale composition; avoid recognizable melodies and industrial/alarm timbres.
3. Regenerate only owned generated assets through the provided script; do not incorporate unknown radio MP3 files.
4. Register accurate project-owned attribution and audio IDs. Preserve existing success, alarm, and door cues.
5. Run generator determinism/manifest/sample tests and record asset sizes/durations.

## Task 7: Correct audio lifecycle, dedupe, and finale sequencing

**Files:**
- Modify: `src/features/bunker/v2/BunkerScreenGuard.tsx`
- Modify: its focused tests
- Modify: `src/lib/bunkerAudio.ts` only if Task 6 did not fully expose the needed lifecycle method

**Steps:**
1. Add failing tests that mission music begins once after user audio re-arm, does not restart on every narration/mission render, pauses during alarm/door/reveal as required, and cannot overlap a duplicate door cue.
2. Add failing tests that opening the bunker starts the finale cue once after the door/reveal transition and that leaving results/restarting stops it.
3. Implement one owner for door playback, guarded play tokens for ambience/finale, and retry only when a user re-arms blocked audio.
4. Keep narration once-per-ID and existing success cue behavior.
5. Run the guard/audio tests, including blocked-autoplay and re-arm cases.

## Task 8: Integration, mobile/projector proof, and GitHub publication

**Files:**
- Add only ignored evidence under `artifacts/release-audit-20260825/`
- Do not commit `artifacts/`

**Steps:**
1. Run all focused mission, operator, screen, style, audio, and MK regression tests.
2. Run `git diff --check`, `npm run typecheck`, `npm test`, and `npm run build` from the repository root.
3. Launch the local app and perform a browser rehearsal at phone and projector widths: register enough synthetic guests for 2 and 4 wagons, exercise all six missions, confirm each participant/wagon/operator state, keep Liza's choices visible, complete final access, and capture screenshots of the primary path and finale.
4. Verify the admin recovery controls still open/advance the Bunker and that a two-phone/two-wagon run remains understandable.
5. Fetch `lovable/main`, compare new commits, and reconcile without overwriting unrelated changes.
6. Commit the complete production change. Push only the reviewed branch to the GitHub ref connected to Lovable; never edit Lovable directly.
7. Report the commit SHA, exact verification results, asset durations, and screenshot paths.
