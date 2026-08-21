# Guest Hub + Timed Live Quiz — Merge Gate Status

Implementation is assembled on `feat/guest-hub-live-quiz`.

Final verification policy for this package follows the approved faster workflow: one full unit/typecheck/build/database/Playwright run on the final pull-request head, rather than full E2E after each small edit.

Scope implemented: persistent guest hub, automatic embedded Live Quiz, server-authoritative 30-second voting + 30-second results for standard questions, admin early close/next/return-main controls, completed-question history, and shared TV deadline display. Final Five remains manual/untimed. MK hub integration and Bunker quest gameplay remain follow-up packages.

