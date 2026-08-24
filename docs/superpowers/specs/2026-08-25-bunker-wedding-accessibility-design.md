# Bunker Wedding Accessibility Redesign

**Date:** 2026-08-25  
**Status:** Approved direction; awaiting written-spec review  
**Target:** Bunker V2 guest phones, Liza operator cabinet, owner controls, projector and finale

## Goal

Turn the existing Bunker V2 into a clear wedding adventure that older guests can understand without continuous help from the host. Preserve the six-mission story and server contracts, show one primary action at a time, retain Liza's phrases and choices, replace the industrial mood with warm wedding presentation and add original project-owned instrumental music.

## Product Principles

1. No new game mechanics, missions, routes or database-owned states.
2. One visible primary action per screen; secondary data is collapsed or moved to recovery/details.
3. Real guests never appear to be punished or expelled. Mission 1 describes story characters moving to a reserve carriage.
4. Liza remains an active participant. Her operator phrases and choices stay available in M2, M4, M6 and the finale; deterministic fallback remains only as timeout protection.
5. The owner keeps recovery controls, but ordinary play does not expose diagnostics or emergency actions.
6. Every success state is understandable from text without relying only on color, sound or motion.
7. No emoji, CSS-art, fake decorative assets, flashing, strobing or cropped faces.

## Simplified Mission Flow

### Mission 1 — Reserve Carriage

- Keep the exact server quota, character cards and final selection payload.
- Replace punitive wording with a story-safe reserve-carriage explanation; real guests do not leave the game.
- Collapse the long briefing behind `Подробнее`.
- Show selected names and quota immediately above one final confirmation button.
- Remove the second confirmation modal from the normal path.
- Keep owner override only inside the recovery section.

### Mission 2 — Black Box

- Keep six evidence fragments, three answers and the existing submit payload.
- Present questions sequentially: one question and its choices at a time.
- Evidence becomes a clearly labelled hint drawer rather than six competing cards.
- Show `Шаг 1 из 3`, persistent selection and one final `Проверить версию` action.
- Hide attempts and special abilities until an error or explicit `Дополнительно` expansion.
- Keep Liza's M2 phrase choice in her cabinet.

### Mission 3 — Emergency Supplies

- Captain remains the only person who confirms one to three problems.
- Other guests receive a passive discussion instruction and do not see disabled controls as actions.
- Visually mark problems that cannot be solved with current stock.
- Move abilities and pending commitments to `Дополнительно`.
- Keep the same inventory consumption and confirmation payload.

### Mission 4 — Carriage Communication

- Keep the required message from every carriage and the shared answer phase.
- The assigned communicator sees three prepared valid messages and sends one; free-form composition is secondary.
- Other guests see who the communicator is and one instruction: discuss the answer aloud.
- Trades, item selectors and trade history leave the primary path and move to `Дополнительно`/owner recovery.
- When the message phase completes, show only the common answer choices and one confirmation.
- Keep Liza's M4 phrase choice in her cabinet.

### Mission 5 — One Chance

- Keep the existing majority vote and routes A/B.
- Show two short, large route cards with one action each.
- Hide live vote totals and abilities from the primary path.
- After voting, keep a permanent text confirmation and disable further input.
- Projector shows only discussion/decision status, not noisy vote details.

### Mission 6 — Common Protocol

- Reuse the existing idempotent reveal-fragment command automatically when a carriage first opens the mission.
- Keep fragment information available, but do not require a separate publish step.
- Show one A/B/C decision after the shared information, with persistent accepted state.
- Move abilities and detailed consensus counters to `Дополнительно`.
- Keep Liza's M6 phrase choice in her cabinet.

### Finale

- Keep the existing five values and one `request_access` payload.
- Present inputs sequentially, one value per step, then show a compact five-value review.
- Projector shows the timer and `N из 5 параметров`, with the couple image as the emotional focus.
- Keep Liza's finale phrase choice and reveal sequence.
- Keep owner hint, time extension and emergency open in a closed recovery section.

## Persistent Mobile Experience

- Default body text: at least 18 px, line-height 1.5–1.65.
- Large-text mode: at least 20 px body text.
- Bottom navigation: at least 16 px labels and 58–64 px height.
- Buttons, labels and selects: at least 56 px high.
- Checkbox/radio visuals: at least 24×24 px with at least 12 px spacing to text.
- During an active mission, the first view contains the current goal, progress and primary action. Character, inventory and diagnostics remain accessible through `Ещё`.
- Long Russian instructions use normal case and sans/serif body typography; monospace uppercase remains only for codes, timers and short statuses.
- Light and dark surfaces receive separate high-contrast focus rings.

## Projector And Wedding Direction

- Replace black terminal cards with warm paper/champagne cards using burgundy text.
- Secondary projector text is at least 18 px at 1280×720; primary instructions are 22–24 px or larger.
- Preserve at least 4.5:1 contrast, targeting 7:1 for projector content viewed in ambient light.
- Use a single 500–700 ms warm crossfade instead of blackout, scan tears or looping glitch.
- Mission success uses a one-time 450 ms champagne border wash plus the existing textual success state.
- Viktor's existing route image becomes a larger naturally lit side image; the timer remains on a separate readable panel.
- Liza's reveal becomes a warm rose/champagne scene with a larger uncropped portrait and her chosen phrase.
- Finale preserves full faces with contained central photography and blurred photo-derived side fill.
- `prefers-reduced-motion` shows final states immediately.

## Audio Direction

### Mission Music

- Replace the current industrial `bunker.ambience` loop with an original project-owned instrumental loop.
- Character: light train waltz, warm piano/pad/strings impression, no vocals, quotations, recognizable melodies or external samples.
- Plays on the projector during active missions only.
- Ducks below narration, alarm and major reveal cues through the existing audio priority system.
- Does not restart on each mission or volume-slider update.

### Finale Music

- Add one original project-owned 40–50 second instrumental finale with baked fade-in and fade-out.
- Door cue plays first, reveal cue follows, then the wedding finale begins.
- It does not restart on ordinary state refreshes and remains governed by projector mute and master volume.
- Existing unverified radio MP3 files are not used as music.

### Success Cues

- Reuse the existing project-owned `ui.success` cue once when a mission changes to completed.
- Sound never replaces visible confirmation text.

## Architecture

- Keep Supabase mission states and payload contracts unchanged.
- Implement simplification in guest/player components and presentation models.
- Reuse existing idempotent commands for M6 auto-reveal; do not create a new game state.
- Keep M4 trading services and owner recovery available even when the primary guest UI hides them.
- Extend the existing audio manifest and generator with project-owned WAV assets and verified attribution.
- Keep audio lifecycle ownership in `BunkerScreenGuard`/`bunkerAudio`; prevent duplicate sources on re-arm and volume changes.
- Preserve Liza operator RPCs and UI choices.

## Error And Recovery Behavior

- A failed command leaves the user's selection visible and shows one plain recovery sentence.
- Reconnection never clears a local selection that has not yet been rejected by the server.
- If the assigned M4 communicator is absent, the owner recovery section remains the fallback.
- Deadline fallback and emergency open remain available; they are not promoted as ordinary actions.
- Audio failure or autoplay blocking never interrupts mission progress.

## Testing And Acceptance

- Each behavior change starts with a failing component/service test.
- Verify all six guest missions at 390×844 and the projector at 1280×720.
- Confirm normal and large-text modes, 200% browser zoom, keyboard focus and reduced motion.
- Confirm Liza can make her choices in M2, M4, M6 and the finale.
- Confirm original music respects mute, volume, re-arm, narration ducking and mission/finale lifecycle.
- Run the complete Vitest suite, TypeScript check and production build.
- Publish only by pushing the reviewed commit to the GitHub branch connected to Lovable.

## Non-Goals

- No reduction from six missions to fewer server stages.
- No replacement of Liza with automatic narration.
- No copyrighted commercial songs.
- No deletion of owner recovery or server-side trading data.
- No direct edits in Lovable.
