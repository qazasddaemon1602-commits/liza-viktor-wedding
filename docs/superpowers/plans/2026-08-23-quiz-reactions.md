# Quiz reactions implementation plan

> Spec: `docs/specs/2026-08-23-wow-polish.md`

1. Add failing tests for voting-entry and result-reveal reaction hooks and audio callbacks.
2. Reuse the shared transition component for quiz phase changes.
3. Add quiz cues through the existing projector audio boundary and avoid replay on ordinary rerenders.
4. Run quiz, audio, and screen regression tests.
