# Cinematic Audio System — Clarification

This clarification is part of `2026-08-20-cinematic-audio-system-design.md`.

## Guest phone interaction coverage

The requirement is stronger than “most meaningful buttons”. **Every actionable button, answer option, choice control, submit/confirm action, and in-app navigation control on the guest phone should produce an appropriate restrained audio cue when site sound is enabled.**

Exceptions are only passive/non-action elements (scrolling, plain text, decorative UI) and browser-native behavior that the site does not control. The sound toggle itself may use a final quiet feedback cue when turning sound off and a cue when turning it back on.

The first guest interaction should also be used to arm/unlock browser audio. If the browser only permits audio after that gesture, the interaction must still complete normally even when its own cue cannot be heard; subsequent interactions use the normal sound vocabulary.

This does not change the cinematic restraint principle: universal interaction coverage means every action has feedback, not that every action is loud.