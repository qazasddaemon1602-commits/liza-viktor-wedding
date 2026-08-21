# Amendment — Advisory readiness and projector audio control

Date: 2026-08-20
Status: Approved owner amendment

This amendment supersedes any earlier wording that required owner/admin manual event controls to wait for projector, video, audio, guest-count, or expected-screen readiness.

## Readiness is display-only

All readiness, presence, preflight, and rehearsal status indicators are advisory telemetry only.

- Owner/admin manual controls must never be disabled or rejected because TV/projector presence is missing.
- Owner/admin manual controls must never be disabled or rejected because video or browser audio is not ready.
- Guest-count/quorum recommendations never gate a manual launch.
- Zero, one, two, or more projector/screen clients are all valid operating configurations.
- Status UI may remain red/amber/green and must report the truth, but it must clearly communicate that it does not block launch.
- Security/auth checks and valid server-state transitions remain enforced.
- No auto-start is introduced; the owner decides when to launch.

In particular, `НАЧАТЬ ПРЕМЬЕРУ` is available whenever the premiere is configured, in standby, and no owner command is currently running. Technical readiness is not part of the disabled condition.

## Projector audio control

Text buttons such as `ВЫКЛЮЧИТЬ ЗВУК` / `ВКЛЮЧИТЬ ЗВУК` are replaced by a compact device-local control on projector routes:

- minimal speaker/muted icon button;
- adjacent volume range slider, 0–100;
- default volume for a device with no stored preference: 75%;
- sound preference defaults ON;
- icon click toggles mute while remembering the last non-zero volume;
- slider at 0 means muted;
- moving the slider above 0 automatically unmutes;
- mute and volume persist device-locally in `localStorage`;
- `aria-label`/keyboard behavior must remain accessible.

The projector preference applies to all site-generated audio on that device, including UI cues, train/arrival/carriage-call audio, premiere countdown cues, premiere media volume, and bunker alarm audio. Browser autoplay restrictions may affect whether sound is physically armed, but they never block event actions.

## Acceptance

1. Readiness indicators continue updating with real values.
2. No readiness/preflight value disables an owner manual event action.
3. Premiere starts manually even with 0 connected screens / video not ready / audio not armed.
4. The projector exposes only the compact speaker icon + volume slider, not the old text sound button.
5. Mute is real mute; volume changes propagate to projector audio paths.
6. Carriage call remains 12 seconds while ordinary registration arrival remains approximately 5.6 seconds.

