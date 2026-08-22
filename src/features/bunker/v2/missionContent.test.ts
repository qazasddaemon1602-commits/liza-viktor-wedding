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

  it('returns undefined for missions that are not authored yet', () => {
    expect(bunkerMissionContentKeys()).toContain('M01');
    expect(bunkerMissionContent('M02')).toBeUndefined();
  });
});
