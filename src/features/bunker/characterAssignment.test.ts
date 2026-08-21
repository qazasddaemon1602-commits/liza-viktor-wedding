import { describe, expect, it } from 'vitest';
import { BUNKER_CHARACTER_PROFILES } from './characterPool';
import {
  assignV2Characters,
  assignCharacterProfiles,
  characterCategoryCounts,
} from './characterAssignment';

function guests(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `guest-${index + 1}`);
}

function balancedWagons(count: number): Map<string, string> {
  const wagonCount = count <= 18 ? 2 : count <= 26 ? 3 : count <= 36 ? 4 : 5;
  return new Map(guests(count).map((guestId, index) => [guestId, `wagon-${(index % wagonCount) + 1}`]));
}

function frequencies(assignments: readonly { profileKey: string }[]): number[] {
  return [...assignments.reduce((result, { profileKey }) => {
    result.set(profileKey, (result.get(profileKey) ?? 0) + 1);
    return result;
  }, new Map<string, number>()).values()];
}

describe('controlled Bunker character assignment', () => {
  it.each(Array.from({ length: 26 }, (_, index) => index + 15))(
    'assigns the V2 quota mix deterministically for %i guests',
    (count) => {
      const guestIds = guests(count);
      const wagonByGuest = balancedWagons(count);
      const result = assignV2Characters(guestIds, wagonByGuest, 'run-seed');
      expect(result).toHaveLength(count);
      expect(new Set(result.slice(0, Math.min(count, 36)).map((entry) => entry.profileKey)).size)
        .toBe(Math.min(count, 36));
      expect(Math.max(...frequencies(result))).toBeLessThanOrEqual(2);
      expect(assignV2Characters(guestIds, wagonByGuest, 'run-seed')).toEqual(result);
    },
  );

  it.each([15, 18, 19, 20, 21, 29])('meets the approved V2 category quotas for %i guests', (count) => {
    const counts = characterCategoryCounts(assignV2Characters(
      guests(count), balancedWagons(count), `quota-${count}`,
    ));
    const expected = count <= 18
      ? { technical: 2, medical: 1, information: 1, communication: 2, analytical: 2, bunker: 1, navigation: 1 }
      : count <= 20
        ? { technical: 2, medical: 2, information: 1, communication: 2, analytical: 2, bunker: 1, navigation: 1 }
        : { technical: 3, medical: 2, information: 2, communication: 3, analytical: 3, bunker: 2, navigation: 2 };
    for (const [category, minimum] of Object.entries(expected)) {
      expect(counts[category as keyof typeof counts]).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('separates controlled repeats across wagons when balanced wagons permit it', () => {
    const wagonByGuest = balancedWagons(40);
    const assignments = assignV2Characters(guests(40), wagonByGuest, 'wagon-repeat-seed');
    const wagonsByProfile = new Map<string, Set<string>>();
    assignments.forEach(({ guestId, profileKey }) => {
      const wagons = wagonsByProfile.get(profileKey) ?? new Set<string>();
      wagons.add(wagonByGuest.get(guestId) as string);
      wagonsByProfile.set(profileKey, wagons);
    });
    for (const [profileKey, count] of [...assignments.reduce((result, { profileKey }) => {
      result.set(profileKey, (result.get(profileKey) ?? 0) + 1);
      return result;
    }, new Map<string, number>())]) {
      if (count === 2) expect(wagonsByProfile.get(profileKey)?.size).toBe(2);
    }
  });

  it.each(Array.from({ length: 26 }, (_, index) => index + 15))(
    'keeps SQL-parity assignment coverage for every supported event size from 15 to 40: %i',
    (count) => {
      const assignment = assignCharacterProfiles(guests(count), `range-${count}`);
      expect(assignment).toHaveLength(count);
      expect(new Set(assignment.map((entry) => entry.guestId)).size).toBe(count);
    },
  );

  it.each([12, 16, 20, 32, 40])('assigns every one of %i guests exactly once', (count) => {
    const assignment = assignCharacterProfiles(guests(count), 'run-2026');
    expect(assignment).toHaveLength(count);
    expect(new Set(assignment.map((entry) => entry.guestId)).size).toBe(count);
    expect(assignment.every((entry) => BUNKER_CHARACTER_PROFILES.some(
      (profile) => profile.key === entry.profileKey,
    ))).toBe(true);
  });

  it('is stable for a run but changes the hidden distribution for another run', () => {
    const currentGuests = guests(20);
    const first = assignCharacterProfiles(currentGuests, 'run-a');
    expect(assignCharacterProfiles(currentGuests, 'run-a')).toEqual(first);
    expect(assignCharacterProfiles(currentGuests, 'run-b')).not.toEqual(first);
  });

  it.each([12, 16, 20, 32, 40])('guarantees all mandatory categories for %i guests', (count) => {
    const categoryCounts = characterCategoryCounts(
      assignCharacterProfiles(guests(count), `mandatory-${count}`),
    );
    for (const category of [
      'technical', 'medical', 'information', 'communication', 'bunker', 'navigation',
    ] as const) {
      expect(categoryCounts[category]).toBeGreaterThanOrEqual(1);
    }
  });

  it.each([15, 16, 17, 18, 19, 20])('uses the small-game target mix for %i guests', (count) => {
    const categoryCounts = characterCategoryCounts(
      assignCharacterProfiles(guests(count), `small-${count}`),
    );
    expect(categoryCounts.technical).toBeGreaterThanOrEqual(2);
    expect(categoryCounts.medical).toBeGreaterThanOrEqual(count >= 18 ? 2 : 1);
    expect(categoryCounts.communication).toBeGreaterThanOrEqual(2);
    expect(categoryCounts.analytical).toBeGreaterThanOrEqual(2);
    expect(categoryCounts.bunker).toBeGreaterThanOrEqual(1);
    expect(categoryCounts.navigation).toBeGreaterThanOrEqual(1);
  });

  it.each(Array.from({ length: 26 }, (_, index) => index + 15))(
    'preserves category invariants for %i players across independent run nonces',
    (count) => {
      for (const nonce of ['alpha', 'bravo', 'charlie', 'delta']) {
        const assignment = assignCharacterProfiles(guests(count), `${nonce}-${count}`);
        const counts = characterCategoryCounts(assignment);
        expect(counts.technical).toBeGreaterThanOrEqual(count <= 20 ? 2 : 1);
        expect(counts.medical).toBeGreaterThanOrEqual(count >= 18 && count <= 20 ? 2 : 1);
        expect(counts.communication).toBeGreaterThanOrEqual(count <= 20 ? 2 : 1);
        expect(counts.bunker).toBeGreaterThanOrEqual(1);
        expect(counts.navigation).toBeGreaterThanOrEqual(1);
        if (count <= 20) expect(counts.analytical).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it('does not treat the memory-only photographer profile as analytical', () => {
    expect(characterCategoryCounts([
      { guestId: 'photographer-guest', profileKey: 'photographer' },
    ]).analytical).toBe(0);
  });

  it('uses all thirty-six profiles before repeating any for forty guests', () => {
    const assignment = assignCharacterProfiles(guests(40), 'large-run');
    const frequencies = new Map<string, number>();
    assignment.forEach(({ profileKey }) => {
      frequencies.set(profileKey, (frequencies.get(profileKey) ?? 0) + 1);
    });
    expect(frequencies.size).toBe(36);
    expect(Math.max(...frequencies.values())).toBe(2);
  });

  it('rejects duplicate guests and a missing run seed', () => {
    expect(() => assignCharacterProfiles(['g1', 'g1'], 'run')).toThrow(/unique/i);
    expect(() => assignCharacterProfiles(['g1'], '')).toThrow(/seed/i);
  });
});
