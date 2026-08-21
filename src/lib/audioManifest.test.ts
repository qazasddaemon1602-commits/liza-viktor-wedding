import { describe, expect, it } from 'vitest';
import { AUDIO_MANIFEST, audioCueIds, hasLocalAudioSource } from './audioManifest';

describe('audio manifest', () => {
  it('keeps every acquired runtime source local and every cue attributable', () => {
    expect(audioCueIds.length).toBeGreaterThan(0);

    for (const id of audioCueIds) {
      const cue = AUDIO_MANIFEST[id];
      if (cue.src !== null) {
        expect(cue.src).toMatch(/^\/audio\//);
        expect(cue.src).not.toMatch(/^https?:\/\//);
        expect(hasLocalAudioSource(id)).toBe(true);
      } else {
        expect(hasLocalAudioSource(id)).toBe(false);
      }

      expect(cue.attribution.license).not.toHaveLength(0);
      expect(cue.attribution.status).toMatch(/^(pending|verified)$/);
    }
  });

  it('ships every production cue as a verified local asset', () => {
    for (const id of audioCueIds) {
      const cue = AUDIO_MANIFEST[id];

      expect(cue.src, `${id} must have a production sample`).not.toBeNull();
      expect(cue.attribution.status, `${id} attribution must be verified`).toBe('verified');
      expect(cue.attribution.license, `${id} licence must be explicit`).not.toHaveLength(0);
      expect(cue.attribution.originalFilename, `${id} needs its source filename`).toMatch(/\.(wav|ogg)$/i);
    }
  });

  it('requires the major scene cues to use verifiable acoustic recordings', () => {
    const recordedCueIds = [
      'arrival.sequence',
      'bunker.alarm',
      'bunker.ambience',
      'bunker.door',
      'tournament.gong',
    ] as const;

    for (const id of recordedCueIds) {
      const cue = AUDIO_MANIFEST[id];

      expect(cue.sourceType, `${id} must not be procedural`).toBe('recording');
      expect(cue.attribution.status, `${id} attribution must be verified`).toBe('verified');
      expect(cue.attribution.sourceUrl, `${id} needs a stable source page`).toMatch(/^https:\/\//);
      expect(cue.attribution.license, `${id} must not claim procedural ownership`).not.toContain(
        'procedural synthesis',
      );
      expect(cue.attribution.assetSha256, `${id} needs a pinned production recording`).toMatch(
        /^[a-f0-9]{64}$/,
      );
    }
  });
});
