# Task 1 report: Projector winner and quiz presentation identity

## Changed files

- `src/features/quiz/quizPresentation.ts` — added stable quiz presentation and announcement keys.
- `src/features/quiz/quizPresentation.test.ts` — covers both identity helpers.
- `src/features/screen/ScreenPage.tsx` — made the active announcement a single projector winner, moved quiz cues to the winning quiz boundary, and retained the presented key until `eventSlug` changes.
- `src/features/screen/ScreenPage.quiz.test.tsx` — covers hidden quiz updates, unchanged return, closed quiz while hidden, and event-slug reset.
- `src/features/screen/QuizScreenScene.tsx` — removed scene-owned cue handling and exposed the scene test id.
- `src/features/screen/QuizScreenScene.test.tsx` — removes the obsolete scene cue contract.

## RED

Command:

```text
npm test -- --run src/features/quiz/quizPresentation.test.ts src/features/screen/ScreenPage.quiz.test.tsx src/features/screen/QuizScreenScene.test.tsx
```

Expected failures observed:

- `quizPresentation` could not be resolved because the identity helpers did not exist.
- `quiz-screen-scene` was still mounted under a guest announcement.
- the same quiz identity did not cue again after an `eventSlug` change.

## GREEN

Commands:

```text
npm test -- --run src/features/quiz/quizPresentation.test.ts src/features/screen/ScreenPage.quiz.test.tsx src/features/screen/QuizScreenScene.test.tsx src/features/screen/ScreenPage.premiere.test.tsx src/features/screen/ScreenPage.mortal-kombat.test.tsx src/features/screen/ScreenPage.bunker-protection.test.tsx
npm run build
```

Results:

- 6 test files and 23 tests passed.
- Production build passed (`tsc --noEmit` and Vite build).

## Self-review

- Bunker, premiere, and Mortal Kombat remain above announcements in the projector priority branch.
- A quiz cue is emitted only when the plain quiz scene wins projector visibility; final-five and couple-answer reveals keep their existing cue behavior.
- `lastPresentedQuizKeyRef` is reset only in the `eventSlug` effect, preserving identity across temporary hidden states.

## Commit

`feat: enforce projector scene visibility`

## Concerns

None. The build retains the pre-existing Vite large-chunk advisory.
