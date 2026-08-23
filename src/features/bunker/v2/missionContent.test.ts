import { describe, expect, it } from 'vitest';
import {
  bunkerMissionContent,
  bunkerMissionContentKeys,
} from './missionContent';

describe('Bunker V2 mission content layer', () => {
  it('provides one shared M01 content source for guest and owner', () => {
    const content = bunkerMissionContent('M01');
    expect(content).toBeDefined();
    expect(content?.title).toBe('Лишний пассажир');
    expect(content?.story.length).toBeGreaterThan(20);
    expect(content?.goal.length).toBeGreaterThan(10);
    expect(content?.steps.length).toBeGreaterThanOrEqual(3);
    expect(content?.items.length).toBeGreaterThanOrEqual(1);
    expect(content?.consequences.length).toBeGreaterThanOrEqual(2);
  });

  it('includes a host script with spoken text, hints and next action', () => {
    const host = bunkerMissionContent('M01')?.host;
    expect(host?.say.length).toBeGreaterThanOrEqual(2);
    expect(host?.hints.length).toBeGreaterThanOrEqual(2);
    expect(host?.afterCompletion).toMatch(/задани/i);
  });

  it('uses the same anonymous Viktor-to-BK-17 route in the shared M01 briefing', () => {
    const content = bunkerMissionContent('M01');
    const publicCopy = [
      content?.story,
      content?.goal,
      ...(content?.host.say ?? []),
    ].join(' ');

    expect(publicCopy).toMatch(/Виктор ведёт поезд.*BK-17/i);
    expect(content?.goal).toMatch(/довести поезд Виктора до BK-17/i);
    expect(publicCopy).toMatch(/неизвестн.*источник/i);
    expect(publicCopy).not.toMatch(/Лиза/i);
  });

  it('returns undefined for missions that are not authored yet', () => {
    expect(bunkerMissionContentKeys()).toContain('M01');
    expect(bunkerMissionContent('M02')).toBeUndefined();
  });
});
