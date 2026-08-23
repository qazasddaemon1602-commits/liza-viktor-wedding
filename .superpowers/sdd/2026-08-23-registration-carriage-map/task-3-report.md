# Task 3 report — QR preview and automatic full-screen switch

## Outcome

- Kept the registration ticket and QR as the primary idle scene while the authoritative map status is `registration`.
- Added the exact `ОТКРЫТЬ КАРТУ СОСТАВА` / `ВЕРНУТЬ QR` controls and a local `M` shortcut. These controls only change component state and do not call any server mutation.
- Added one public carriage-map loader to `ScreenPage`, with an initial request, guest-registration refresh signal and a 2-second polling fallback for owner reassignments.
- Coalesced refresh signals while a request is in flight, prevented same-lifecycle request overlap, ignored stale results after cleanup and preserved the last valid map on transient failure.
- Automatically replaces the QR with the full map only when the parsed authoritative state is `complete`; `not_found` keeps the existing idle scene.

## RED evidence

```text
npm test -- --run src/features/screen/IdleRegistrationScreen.test.tsx src/features/screen/ScreenPage.registration-map.test.tsx
Test Files 2 failed (2)
Tests 9 failed | 5 passed (14)
```

The failures covered the absent preview controls/keyboard behavior, loader, event refresh, 2-second polling, overlap guard, last-valid preservation, automatic completion promotion and cleanup.

## GREEN evidence

```text
npm test -- --run src/features/screen/IdleRegistrationScreen.test.tsx src/features/screen/ScreenPage.registration-map.test.tsx
Test Files 2 passed (2)
Tests 15 passed (15)

npm test -- --run src/features/screen
Test Files 24 passed (24)
Tests 140 passed (140)

npm run typecheck
passed

npm run build
273 modules transformed; build passed

npm test -- --run
Test Files 253 passed (253)
Tests 1369 passed (1369)

git diff --check
passed (Git LF/CRLF notices only)
```

The build retained the existing advisory about a JavaScript chunk larger than 500 kB. Vitest retained the existing jsdom notices for unimplemented `HTMLMediaElement.load()`.

## Self-review notes

- Projector precedence is unchanged: Bunker, Premiere, Mortal Kombat and quiz scenes still render before the carriage map; arrival/call scenes remain overlays.
- The guest-registration event is used only as a private-safe reload signal. Names from `screen_events` are not copied into the map.
- A boolean queued-refresh latch bounds bursts to one follow-up load, so the polling timer and realtime signal do not become competing request loops.
- Online recovery reuses the same guarded loader instead of starting a second polling mechanism.
- Only the five Task 3 source/test/style files and this required report were changed.
