# Final Event Experience Design

## Goal

Deliver a production-ready wedding event experience in which the host can run the full evening from one console, Bunker missions are understandable and live on every device, accessibility is suitable for older guests, every quiz question has a matching editorial image, and Bunker story intros have free Russian voice narration.

## Release boundary

The implementation starts from `origin/main` at merge commit `0946022`. It must preserve the user's Lovable wow-polish commit `b158e61`, use GitHub as the only delivery channel to Lovable, and must not edit through the Lovable UI. Production release requires green unit, build, database and browser workflows before merge.

## Experience architecture

The existing React/Supabase architecture remains authoritative. New work extends the current Bunker runtime, owner RPCs, mission content, quiz `image_path` pipeline and admin shell rather than adding parallel state stores.

The work is split into independently testable domains:

1. Owner live convergence and final safety.
2. Guest mission clarity, real item transfer and character ability use.
3. Large-text accessibility and responsive verification.
4. Per-mission projector replay and browser-native Russian narration.
5. A master host runbook for the whole event.
6. A complete editorial image set for all 30 seeded quiz questions.
7. Integrated verification and GitHub-only release.

## Owner live console

`AdminBunkerControl` must converge without page reload when guests submit mission actions. It will combine a lightweight Bunker refresh subscription with a bounded polling fallback while the game is active. Refreshes are deduplicated and must not clear the last valid owner state during short network failures.

The current mission section shows each enabled wagon as ready or incomplete, the last submitted decision in human language, whether completion was forced, and item/route effects that the host needs to explain. Force-complete is offered only for incomplete wagons.

Normal `FINAL_30 → BUNKER_OPEN` transition is enabled only after the server reports `unlocked_at`. A separate recovery command can force the door open only after a reason is entered and a second confirmation is completed; the action is written to the owner audit log.

## Guest mission clarity

M03 becomes a five-problem board. Every problem card names the risk, its current state and the inventory item that resolves it. Selecting an item updates a preview showing “closed risks” and “risks that remain” before submission.

M04 becomes a four-step communication board: identify the assigned group, read the wagon's own fragment, exchange fragments with the named partner wagons, then submit the reconstructed message. The same mission adds real server-side transfer of one selected available item to a partner wagon, including `transferred` status, destination and an audit event.

Character abilities gain an explicit one-use action. Server validation checks ownership, active run, remaining uses and mission applicability, applies the defined effect, decrements `ability_uses_remaining`, and records the action. The phone explains the effect before confirmation and the result afterwards.

## Older-guest accessibility

The Bunker phone dashboard adds a persistent `КРУПНЫЙ ТЕКСТ` toggle stored locally. Large mode raises body and control text to at least 18px, metadata to at least 16px and interactive targets to at least 52px. Seven primary tabs are replaced on narrow phones by four high-frequency tabs plus an `ЕЩЁ` menu so labels do not collapse into a dense two-row control.

Keyboard focus, form labels, reduced motion and semantic status announcements remain intact. Layout acceptance is tested at 320×720 and 390×844 for phones, and 1366×768 and 1920×1080 for the projector.

## Projector intros and narration

Every M01–M06 state gets its own scene identity, so crossing from M03 to M04 or M05 to M06 replays the artistic intro instead of retaining the previous phase component. The existing artwork and motion language remain unchanged.

Free narration uses the browser `speechSynthesis` API with the Russian text already stored in `missionContent.intro.narration`. It plays once per mission only after projector audio has been armed by a user gesture. The sound control exposes narration on/off and replay. If no Russian voice is installed or synthesis fails, the text remains visible and the existing ambience continues; narration failure never blocks the mission.

## Master event runbook

The admin shell gains a single `EventHostRunbook` before module-specific controls. It covers arrival/registration, premiere, carriage assignment, standard quiz, final five, Mortal Kombat, Bunker prologue and missions, Bunker final, epilogue and transitions between them.

Each cue contains planned duration, prerequisites, text to read, optional improvisation, technical check, next action and a manual completed marker. The current cue is sticky and first in reading order; the full timeline is collapsible. Completion state is local to the host device because it is operational guidance, not game authority. Module status is derived from existing owner dashboard state and used only to suggest the current cue.

## Quiz editorial images

All 30 seeded standard questions receive a distinct project-local image. Images use the established cream, ink-blue, vintage railway/editorial visual language, contain no text or recognizable real people, and leave calm negative space so the question remains dominant. Each asset is generated separately, inspected, optimized to WebP and AVIF, and stored under `public/images/quiz/` with stable `q01`–`q30` names.

A new idempotent migration updates seeded questions by `sort_order` and `question_type = 'standard'` with `/images/quiz/qNN.webp`. Existing custom owner questions are not changed. Asset contract tests verify all referenced files and dimensions.

## Testing and release

Every production change starts with a failing unit or pgTAP test. Integration verification includes all unit tests, TypeScript build, CSS/layout contract checks, Supabase pgTAP and existing browser workflows. New browser cases verify live owner progress, M03/M04 phone flows, large-text reflow, mission intro replay, narration fallback and quiz images.

Only after all checks are green will the branch be pushed and merged through GitHub. Production Supabase migrations are applied after the exact tested commit is known and before the merge. Lovable receives the result from GitHub sync; no direct Lovable editing is allowed.

## Explicit decisions

- “Images for every quiz question” means all 30 seeded standard questions, which is stricter than the later ambiguous mention of thirteen images.
- Voice narration is browser-native and free; no third-party runtime or paid TTS dependency is introduced.
- The master event timeline is operational and local; game state remains server-authoritative.
- Existing design tokens, imagery and typography are extended, not redesigned.
