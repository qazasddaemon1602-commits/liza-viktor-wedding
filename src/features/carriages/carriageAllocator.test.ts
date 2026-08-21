import { describe, expect, it } from 'vitest';
import {
  balancedCarriageSizes,
  chooseCarriage,
  recommendCarriageCount,
  type AffiliationKey,
  type AllocationSnapshot,
} from './carriageAllocator';

const base: AllocationSnapshot[] = [
  { id: '1', number: 1, total: 4, affiliations: { liza: 3, viktor: 0, common: 1, family: 0, colleagues: 0, other: 0 } },
  { id: '2', number: 2, total: 4, affiliations: { liza: 0, viktor: 3, common: 1, family: 0, colleagues: 0, other: 0 } },
  { id: '3', number: 3, total: 4, affiliations: { liza: 1, viktor: 1, common: 1, family: 1, colleagues: 0, other: 0 } },
  { id: '4', number: 4, total: 5, affiliations: { liza: 1, viktor: 1, common: 1, family: 1, colleagues: 1, other: 0 } },
  { id: '5', number: 5, total: 5, affiliations: { liza: 1, viktor: 1, common: 1, family: 1, colleagues: 0, other: 1 } },
];

const emptyAffiliations = (): Record<AffiliationKey, number> => ({
  liza: 0,
  viktor: 0,
  common: 0,
  family: 0,
  colleagues: 0,
  other: 0,
});

describe('chooseCarriage', () => {
  it('never chooses a more populated carriage while a smaller carriage exists', () => {
    const result = chooseCarriage(base, 'liza', () => 0.25);
    expect([1, 2, 3]).toContain(result.number);
  });

  it('uses affiliation diversity as the tie-breaker among least-populated carriages', () => {
    const result = chooseCarriage(base, 'liza', () => 0.25);
    expect(result.number).toBe(2);
  });

  it('does not reshuffle existing assignments when a late guest arrives', () => {
    const before = structuredClone(base);
    chooseCarriage(base, 'common', () => 0.5);
    expect(base).toEqual(before);
  });

  it('keeps forty simulated guests evenly spread across all five carriages', () => {
    const snapshots: AllocationSnapshot[] = Array.from({ length: 5 }, (_, index) => ({
      id: String(index + 1),
      number: index + 1,
      total: 0,
      affiliations: emptyAffiliations(),
    }));
    const affiliations: AffiliationKey[] = [
      'liza', 'viktor', 'common', 'family', 'colleagues', 'other',
    ];

    for (let index = 0; index < 40; index += 1) {
      const affiliation = affiliations[index % affiliations.length]!;
      const selected = chooseCarriage(snapshots, affiliation, () => (index * 0.37) % 1);
      selected.total += 1;
      selected.affiliations[affiliation] += 1;
    }

    const totals = snapshots.map((item) => item.total);
    expect(totals.reduce((sum, total) => sum + total, 0)).toBe(40);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
    expect(totals.every((total) => total === 8)).toBe(true);
  });
});

describe('adaptive carriage planning', () => {
  it.each([
    [12, 2],
    [18, 2],
    [19, 3],
    [26, 3],
    [27, 4],
    [36, 4],
    [37, 5],
    [45, 5],
  ])('recommends the expected active carriage count for %i registered guests', (guestCount, expected) => {
    expect(recommendCarriageCount(guestCount)).toBe(expected);
  });

  it('keeps the two-carriage fallback below twelve guests without blocking the game', () => {
    expect(recommendCarriageCount(0)).toBe(2);
    expect(recommendCarriageCount(11)).toBe(2);
  });

  it.each([
    [16, 2, [8, 8]],
    [20, 3, [7, 7, 6]],
    [24, 3, [8, 8, 8]],
    [32, 4, [8, 8, 8, 8]],
    [40, 5, [8, 8, 8, 8, 8]],
  ])('balances %i guests across %i carriages', (guestCount, carriageCount, expected) => {
    expect(balancedCarriageSizes(guestCount, carriageCount)).toEqual(expected);
  });

  it('rejects unsupported carriage counts instead of silently creating tiny extra teams', () => {
    expect(() => balancedCarriageSizes(20, 1)).toThrow('Carriage count must be between 2 and 5');
    expect(() => balancedCarriageSizes(20, 6)).toThrow('Carriage count must be between 2 and 5');
  });
});
