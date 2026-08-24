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
      'bunker.door',
      'tournament.gong',
    ] as const;

    for (const id of recordedCueIds) {
      const cue = AUDIO_MANIFEST[id];

      expect(cue.sourceType, `${id} must not be procedural`).toBe('recording');
      expect(cue.attribution.status, `${id} attribution must be verified`).toBe('verified');
      expect(cue.attribution.sourceUrl, `${id} needs a stable source page`).toMatch(/^https:\/\//);
      expect(cue.attribution.dateKind, `${id} must identify its acquisition date`).toBe('downloaded');
      expect(cue.attribution.license, `${id} must not claim procedural ownership`).not.toContain(
        'procedural synthesis',
      );
      expect(cue.attribution.assetSha256, `${id} needs a pinned production recording`).toMatch(
        /^[a-f0-9]{64}$/,
      );
    }
  });

  it('keeps the arrival ceremony on its single recorded sequence cue', () => {
    expect(audioCueIds).toContain('arrival.sequence');
    expect(audioCueIds).not.toContain(`arrival.${'chime'}` as never);
  });

  it('registers the looping Bunker mission music as an original train waltz', () => {
    const cue = AUDIO_MANIFEST['bunker.ambience'];

    expect(cue.src).toBe('/audio/bunker/ambience.wav');
    expect(cue.sourceType).toBe('procedural');
    expect(cue.defaultLoop).toBe(true);
    expect(cue.defaultPriority).toBe('scene');
    expect(cue.attribution.status).toBe('verified');
    expect(cue.attribution.author).toBe('Liza & Viktor wedding project');
    expect(cue.attribution.license).toContain('project-owned');
    expect(cue.attribution.sourceUrl).toBeUndefined();
    expect(cue.attribution.dateKind).toBe('generated');
    expect(cue.attribution.edits).toMatch(/3\/4|triple-meter/i);
    expect(cue.attribution.edits).toMatch(/train waltz/i);
    expect(cue.attribution.edits).toMatch(/no vocals|instrumental/i);
    expect(cue.attribution.edits).toMatch(/no external/i);
  });

  it('registers a distinct project-owned Bunker finale without an external source', () => {
    const cue = AUDIO_MANIFEST['bunker.finale'];
    if (!cue) {
      expect(cue).toBeDefined();
      return;
    }

    expect(cue.src).toBe('/audio/bunker/finale.wav');
    expect(cue.src).not.toBe(AUDIO_MANIFEST['bunker.ambience'].src);
    expect(cue.sourceType).toBe('procedural');
    expect(cue.defaultLoop).not.toBe(true);
    expect(cue.defaultPriority).toBe('scene');
    expect(cue.attribution.status).toBe('verified');
    expect(cue.attribution.author).toBe('Liza & Viktor wedding project');
    expect(cue.attribution.license).toContain('project-owned');
    expect(cue.attribution.sourceUrl).toBeUndefined();
    expect(cue.attribution.dateKind).toBe('generated');
    expect(cue.attribution.edits).toMatch(/instrumental/i);
    expect(cue.attribution.edits).toMatch(/no vocals/i);
    expect(cue.attribution.edits).toMatch(/no external/i);
    expect(cue.attribution.edits).toMatch(/fade-in and fade-out/i);
  });

  it('preserves the existing success, alarm, and door cues', () => {
    expect(audioCueIds).toEqual(expect.arrayContaining(['ui.success', 'bunker.alarm', 'bunker.door']));
    expect(AUDIO_MANIFEST['ui.success'].sourceType).toBe('procedural');
    expect(AUDIO_MANIFEST['bunker.alarm'].sourceType).toBe('recording');
    expect(AUDIO_MANIFEST['bunker.door'].sourceType).toBe('recording');
  });
});
