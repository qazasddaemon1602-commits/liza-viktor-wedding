# Train + Quiz Editorial Visuals — Implementation Plan

## Scope

Visual-only continuation of the approved event-day design system.

### Train Arrival
- Preserve existing event payload, `onSignal`, locomotive/consist/track/steam test hooks and scene timing.
- Reframe the scene as an illustrated railway platform announcement inside the Wedding Editorial world.
- Add ticket/platform metadata, paper/ink framing, a restrained original railway emblem, stronger passenger-name hierarchy and an editorial carriage assignment panel.
- Keep the train recognizable and the carriage accent data-driven.

### Quiz / Couple Reveal / Final Five
- Preserve all quiz state, percentages, reveal timing, question images and existing copy.
- Add reusable editorial scene framing, decorative route/stamp motifs and paper-card result treatments.
- Voting stays readable at TV distance; results and couple reveals use oversized serif typography without game-show neon styling.
- Final Five keeps its staged reveal timers unchanged.

## Files

- `src/features/screen/TrainArrivalScene.tsx`
- `src/features/screen/TrainArrivalScene.test.tsx`
- `src/features/screen/QuizScreenScene.tsx`
- `src/features/screen/QuizScreenScene.test.tsx`
- `src/features/screen/CoupleAnswerRevealScene.tsx`
- `src/features/screen/CoupleAnswerRevealScene.test.tsx`
- `src/features/screen/FinalFiveRevealScene.tsx`
- `src/features/screen/FinalFiveRevealScene.test.tsx`
- `src/styles/wedding-scenes.css` (new)
- `src/main.tsx`
- `e2e/device-layout.spec.ts` if needed for Full HD scene layout coverage.

## TDD sequence

1. Add structure tests for editorial train announcement and quiz/reveal frames; confirm RED.
2. Implement DOM-only visual wrappers/decorative markup with no data/state changes; confirm GREEN.
3. Add `wedding-scenes.css` overrides imported after existing train/quiz CSS.
4. Add/adjust Full HD layout E2E only where it validates observable event-screen constraints.
5. Run typecheck, full unit suite, production build and full E2E.
6. Review diff for forbidden changes: no Supabase/migrations/services, no scene-priority changes, no owner controls on `/screen`, no MK/Bunker/Premiere logic changes.

