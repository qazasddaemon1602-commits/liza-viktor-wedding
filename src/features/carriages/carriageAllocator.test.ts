import { describe, expect, it } from 'vitest';
import { chooseCarriage, type AllocationSnapshot } from './carriageAllocator';

const base: AllocationSnapshot[] = [
  { id: '1', number: 1, total: 4, affiliations: { liza: 3, viktor: 0, common: 1, family: 0, colleagues: 0, other: 0 } },
  { id: '2', number: 2, total: 4, affiliations: { liza: 0, viktor: 3, common: 1, family: 0, colleagues: 0, other: 0 } },
  { id: '3', number: 3, total: 4, affiliations: { liza: 1, viktor: 1, common: 1, family: 1, colleagues: 0, other: 0 } },
  { id: '4', number: 4, total: 5, affiliations: { liza: 1, viktor: 1, common: 1, family: 1, colleagues: 1, other: 0 } },
  { id: '5', number: 5, total: 5, affiliations: { liza: 1, viktor: 1, common: 1, family: 1, colleagues: 0, other: 1 } },
];

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
});
