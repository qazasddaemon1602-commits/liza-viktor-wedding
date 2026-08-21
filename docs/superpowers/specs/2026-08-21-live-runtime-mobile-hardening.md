# Live Runtime + Mobile Hardening

**Date:** 2026-08-21  
**Status:** Approved amendment to the wedding game redesign

## Outcome

The production event must recover cleanly from an expired owner session, expose useful command errors, show live guest activities before the ticket, and run Tournament and Bunker reliably from phones and the projector.

## Product rules

- The correct production backend is Supabase project `vogcchocbpqqwhfnzzwy`; legacy project references are forbidden in the production bundle.
- Resetting test data never signs out the owner. A reset that commits but fails to refresh is reported as committed and must not invite an unsafe repeated reset.
- Owner-session expiry is a first-class state. Admin modules show a concise re-login instruction instead of unrelated Arena/Bunker errors.
- Tournament registration may be opened with zero players. A bracket may start with any meaningful count from 2 through 40. One player remains in preparation with an explicit explanation.
- Tournament bracket storage stays deterministic and authoritative. It uses the next power-of-two tree up to 64 slots while exposing only real fights.
- Bunker launch is `prepare -> distribute -> start`; each failed stage is named, the server error is safely surfaced, and the projector continues to derive state from `get_bunker_screen_state`.
- `global_game_state` is the client-visible Bunker progression source. Legacy quest phase must not override it.
- On the guest dashboard, `СЕЙЧАС ПРОИСХОДИТ` appears before the ticket. Carriage call, LIVE QUIZ, and Bunker are immediately visible on a 390 px phone.
- After an owner reset deletes a guest, an open guest page returns to registration after authoritative revalidation. Transient network failure keeps the last ticket visible.
- Mobile admin has 44 px controls, safe-area spacing, compact navigation, readable status, and no horizontal overflow.

## Verification contract

- Every behavior change is introduced by an observed failing test.
- Focused component/service tests, full Vitest, typecheck, and production build pass.
- SQL receives static contract coverage and a rollback-only authenticated production probe before remote application.
- Production is rechecked on guest, admin, screen, LIVE QUIZ, Tournament, and Bunker routes after GitHub/Lovable synchronization.

