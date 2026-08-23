# GitHub E2E failure fix report

## Scope

GitHub exact-SHA E2E run 147 failed in `e2e/bunker-responsive-flow.spec.ts` while checking the M03 large-text navigation at `320x720`. The fifth visible compact navigation button ended at `724.75px`, outside the `720px` viewport. The same run also exposed a strict-mode selector ambiguity in the already-open TV convergence test.

## Evidence and root cause

- Large-text mode sets the navigation font to `1.125rem` (18px).
- At 320px the fixed compact navigation gives four primary columns roughly 64.8px each. `ТЕКУЩЕЕ ЗАДАНИЕ` can therefore wrap to four lines.
- Four lines at `line-height: 1.05`, plus `0.35rem` top/bottom padding and borders, require about `88.8px`.
- The large-text navigation row and shell clearance were only `5.25rem` (84px). Because the grid container uses `overflow: visible`, the intrinsic button box extended about 4.75px below the fixed row, matching the CI measurement.
- Global `box-sizing: border-box` exists, but the compact large-text rule did not constrain the button block size to the reserved row.
- The convergence selector `getByText(/решение вагона принято/i)` matched both the result heading and its status copy. The result heading is the unique semantic assertion target.

## Fix

- Increased the large-text compact navigation reservation from `5.25rem` to `5.625rem` (90px) in both the dashboard token and mobile shell inheritance.
- Constrained large-text compact navigation buttons to `height: 100%`, `max-height: 100%`, and explicit `box-sizing: border-box`, while preserving 18px text and the 52px minimum touch target.
- Added a CSS regression contract covering the 90px row and the button sizing boundary. The contract was observed failing against the 84px implementation before the production CSS change, then passing after it.
- Replaced the ambiguous convergence selector with `getByRole('heading', { name: /решение вагона принято/i })`. The live TV progress assertion remains unchanged (`0 / 2` to `1 / 2`), so convergence coverage is not weakened.

## Verification

- Focused RED: `npm test -- --run src/styles/bunker-responsive.scope.test.tsx` — failed on expected `5.625rem` contract against the old `5.25rem` CSS.
- Focused GREEN: same command — 12/12 passed.
- Full Vitest: `npm test -- --run` — 170 files, 928 tests passed.
- TypeScript: `npm run typecheck` — exit 0.
- Production build: `npm run build` — exit 0.
- E2E discovery only: `npx playwright test --list` — 32 tests listed, including all five authoritative Bunker layout tests.
- `git diff --check` — clean.

Per the release constraint, no local Playwright browser run was performed. The exact viewport behavior must be reconfirmed by GitHub E2E on the resulting commit.
