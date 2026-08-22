# MK projector polish implementation plan

> Spec: `docs/specs/2026-08-23-wow-polish.md`

1. Add failing tests for configured player-limit copy, informative waiting state, and projector scene hooks.
2. Replace hard-coded limit copy with `state.maxPlayers` and give the dedicated waiting state a full-screen arena composition.
3. Add projector-specific bracket sizing and verify at 16:9.
4. Run focused MK tests.
