import { describe, expect, it } from 'vitest';
import {
  BUNKER_CHARACTER_PROFILES,
  validateCharacterPool,
} from './characterPool';

describe('Bunker character pool', () => {
  it('contains the exact thirty-six configured profiles without fictional names', () => {
    expect(BUNKER_CHARACTER_PROFILES).toHaveLength(36);
    expect(new Set(BUNKER_CHARACTER_PROFILES.map((profile) => profile.key)).size).toBe(36);
    expect(new Set(BUNKER_CHARACTER_PROFILES.map((profile) => profile.profession)).size).toBe(36);
    expect(BUNKER_CHARACTER_PROFILES.every((profile) => !('name' in profile))).toBe(true);
    expect(validateCharacterPool(BUNKER_CHARACTER_PROFILES)).toEqual({ valid: true, errors: [] });
  });

  it('gives every role one clear ability and complete playable data', () => {
    for (const profile of BUNKER_CHARACTER_PROFILES) {
      expect(profile.health.trim()).not.toBe('');
      expect(profile.visibleSkill.trim()).not.toBe('');
      expect(profile.hiddenTrait.trim()).not.toBe('');
      expect(profile.specialAbility).toMatch(/^[a-z][a-z0-9_]+$/);
      expect(profile.abilityDescription.trim()).not.toBe('');
      expect(profile.tags.length).toBeGreaterThan(0);
    }
  });

  it('covers every mandatory controlled-random category', () => {
    const tags = new Set(BUNKER_CHARACTER_PROFILES.flatMap((profile) => profile.tags));
    for (const required of [
      'engineering',
      'medicine',
      'cyber',
      'communication',
      'bunker',
      'navigation',
    ]) {
      expect(tags.has(required)).toBe(true);
    }
    expect(BUNKER_CHARACTER_PROFILES.some(
      (profile) => profile.specialAbility === 'bunker_knowledge',
    )).toBe(true);
  });

  it('rejects a malformed or duplicated configuration', () => {
    const duplicate = [
      ...BUNKER_CHARACTER_PROFILES,
      { ...BUNKER_CHARACTER_PROFILES[0] },
    ];
    const result = validateCharacterPool(duplicate);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/key/i),
      expect.stringMatching(/profession/i),
    ]));
  });
});
