# Scene transition template implementation plan

> Spec: `docs/specs/2026-08-23-wow-polish.md`

1. Add component tests for phases, accessible copy, and reduced-motion-safe class hooks.
2. Implement one presentation-only `SceneTransition` component with reusable CSS tokens.
3. Integrate it into existing projector scenes without introducing a new server state or route.
4. Run component and screen regression tests.
