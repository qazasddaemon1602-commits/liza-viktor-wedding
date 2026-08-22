import { describe, expect, it } from 'vitest';

import {
  getBunkerMissionContent,
  normalizeBunkerMissionKey,
  type BunkerMissionKey,
} from './missionContent';

const ALL_MISSIONS: BunkerMissionKey[] = ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'FINAL'];

describe('mission content registry', () => {
  it('provides a complete guest, TV and host briefing for every playable stage', () => {
    for (const key of ALL_MISSIONS) {
      const content = getBunkerMissionContent(key);

      expect(content, `${key} content`).toBeDefined();
      expect(content?.key).toBe(key);
      expect(content?.title.trim()).not.toBe('');
      expect(content?.story.trim()).not.toBe('');
      expect(content?.goal.trim()).not.toBe('');
      expect(content?.steps.length).toBeGreaterThanOrEqual(3);
      expect(content?.consequences.length).toBeGreaterThan(0);
      expect(content?.intro.headline.trim()).not.toBe('');
      expect(content?.intro.narration.trim()).not.toBe('');
      expect(content?.tv.instruction.trim()).not.toBe('');
      expect(content?.tv.artDirection.trim()).not.toBe('');
      expect(content?.host.brief.trim()).not.toBe('');
      expect(content?.host.say.length).toBeGreaterThan(0);
      expect(content?.host.improvise.length).toBeGreaterThan(0);
      expect(content?.host.hints.length).toBeGreaterThan(0);
      expect(content?.host.doNotRevealUntil.length).toBeGreaterThan(0);
      expect(content?.host.afterCompletion.trim()).not.toBe('');

      for (const item of content?.items ?? []) {
        expect(item.label.trim()).not.toBe('');
        expect(item.purpose.trim()).not.toBe('');
      }
    }
  });

  it('routes M01 through the required archive pause without inventing a captain role', () => {
    const mission = getBunkerMissionContent('MISSION_01');
    expect(mission?.host.afterCompletion).toMatch(/архивн.*пауз/i);

    const allOperationalCopy = ALL_MISSIONS.flatMap((key) => {
      const content = getBunkerMissionContent(key);
      return [
        ...(content?.steps ?? []),
        ...(content?.host.say ?? []),
        ...(content?.host.improvise ?? []),
        ...(content?.host.doNotRevealUntil ?? []),
      ];
    }).join(' ');

    expect(allOperationalCopy).not.toMatch(/капитан/i);
  });

  it.each([
    ['M01', 'M01'],
    ['m01', 'M01'],
    ['mission_01', 'M01'],
    ['MISSION_01', 'M01'],
    ['mission-01', 'M01'],
    ['mission_6', 'M06'],
    ['FINAL', 'FINAL'],
    ['FINAL_30', 'FINAL'],
    ['final-30', 'FINAL'],
  ] as const)('normalizes runtime stage %s to content key %s', (runtimeId, expected) => {
    expect(normalizeBunkerMissionKey(runtimeId)).toBe(expected);
    expect(getBunkerMissionContent(runtimeId)?.key).toBe(expected);
  });

  it.each([undefined, null, '', 'BREAK', 'MISSION_07', 'BUNKER_OPEN']) (
    'does not invent mission content for runtime stage %s',
    (runtimeId) => {
      expect(normalizeBunkerMissionKey(runtimeId)).toBeUndefined();
      expect(getBunkerMissionContent(runtimeId)).toBeUndefined();
    },
  );
});
