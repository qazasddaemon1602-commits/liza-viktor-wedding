# Existing-flow wow polish

## Approved scope

- Keep Bunker unchanged.
- Fix the published tournament experience: 16-player limit copy, a useful waiting screen, projector-filling layouts, safe reset, and reroll.
- Finish the guest ticket reveal and the train-arrival scene without adding a new gameplay mechanic.
- Introduce one reusable transition language between existing blocks.
- Reuse the same restrained sound and visual reactions for quiz voting and results.

## Experience principles

- Every effect explains a state change; no decorative delay longer than needed.
- Projector scenes must fill a 16:9 display and remain legible at distance.
- Guest-phone effects must respect reduced motion and must not block recovery or live updates.
- Existing Supabase contracts remain authoritative.
- Bunker files and behavior are out of scope.

## Acceptance

- Tournament public and projector surfaces consistently show the configured maximum of 16.
- Tournament waiting and bracket states are visually complete at 1920x1080.
- Existing reset and reroll controls remain guarded and covered by tests.
- A successful registration visibly progresses through route assignment into the persistent guest hub ticket.
- Arrival, quiz voting, and quiz reveal use the same reusable transition vocabulary and audio controller.
- Unit tests, typecheck, and production build pass.
