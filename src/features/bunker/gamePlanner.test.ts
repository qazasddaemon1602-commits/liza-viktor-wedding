import { describe, expect, it } from 'vitest';
import {
  BUNKER_ABILITY_TAGS,
  buildCommunicationGroups,
  buildControlledAbilityPlan,
  buildFinalInformationPlan,
  buildProtocolFragmentPlan,
  missionOneExclusionCount,
} from './gamePlanner';
import {
  balancedCarriageSizes,
  recommendCarriageCount,
} from '../carriages/carriageAllocator';

describe('adaptive Bunker game planner', () => {
  it.each([
    [15, 4], [16, 4], [17, 4], [18, 4], [19, 4], [20, 5],
    [21, 6], [22, 6], [23, 6], [24, 6], [25, 6], [26, 6],
    [27, 7], [28, 8], [29, 8], [30, 8], [31, 8], [32, 8],
    [33, 8], [34, 8], [35, 8], [36, 8],
    [37, 10], [38, 10], [39, 10], [40, 10],
  ])('matches the SQL Mission 01 exclusion total for %i players', (guestCount, expected) => {
    const wagonSizes = balancedCarriageSizes(
      guestCount,
      recommendCarriageCount(guestCount),
    );
    expect(wagonSizes.reduce(
      (total, wagonSize) => total + missionOneExclusionCount(wagonSize),
      0,
    )).toBe(expected);
  });

  it.each([
    [0, 0], [1, 1], [2, 1],
    [3, 1], [4, 1], [5, 1], [6, 1],
    [7, 2], [8, 2], [9, 2],
    [10, 3], [14, 3],
  ])('excludes %i passenger(s) for a wagon of %i', (wagonSize, expected) => {
    expect(missionOneExclusionCount(wagonSize)).toBe(expected);
  });

  it('builds Mission 04 links from the active wagon ids, not fixed wagon numbers', () => {
    expect(buildCommunicationGroups(['a', 'b'])).toEqual([['a', 'b']]);
    expect(buildCommunicationGroups(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']]);
    expect(buildCommunicationGroups(['a', 'b', 'c', 'd'])).toEqual([
      ['a', 'c'], ['b', 'd'],
    ]);
    expect(buildCommunicationGroups(['a', 'b', 'c', 'd', 'e'])).toEqual([
      ['a', 'b'], ['c', 'd', 'e'],
    ]);
  });

  it.each([2, 3, 4, 5])('creates one necessary Mission 06 fragment per each of %i active wagons', (count) => {
    const wagons = Array.from({ length: count }, (_, index) => `wagon-${index + 10}`);
    const plan = buildProtocolFragmentPlan(wagons);

    expect(plan).toHaveLength(count);
    expect(plan.map((fragment) => fragment.wagonId)).toEqual(wagons);
    expect(plan.every((fragment) => fragment.totalFragments === count)).toBe(true);
    expect(plan.every((fragment) => fragment.requiredWagonIds.length === count - 1)).toBe(true);
  });

  it.each([2, 3, 4, 5])('distributes the five final parameters across %i active wagons', (count) => {
    const wagons = Array.from({ length: count }, (_, index) => `wagon-${index + 1}`);
    const plan = buildFinalInformationPlan(wagons);

    expect(new Set(plan.map((entry) => entry.wagonId))).toEqual(new Set(wagons));
    expect(new Set(plan.map((entry) => entry.parameter))).toEqual(new Set([
      'coordinates', 'sector', 'code', 'gateway_time', 'password',
    ]));
    expect(plan.filter((entry) => entry.parameter === 'coordinates').length).toBeGreaterThanOrEqual(2);
  });

  it('uses controlled random while guaranteeing every key ability archetype', () => {
    const guests = Array.from({ length: 12 }, (_, index) => `guest-${index + 1}`);
    const first = buildControlledAbilityPlan(guests, 'run-2026');
    const repeated = buildControlledAbilityPlan(guests, 'run-2026');

    expect(first).toEqual(repeated);
    expect(first.map((entry) => entry.guestId)).toEqual(expect.arrayContaining(guests));
    const assigned = new Set(first.flatMap((entry) => entry.abilityTags));
    expect(assigned).toEqual(new Set(BUNKER_ABILITY_TAGS));
  });

  it('can cover all required abilities even when fewer than five guests start', () => {
    const plan = buildControlledAbilityPlan(['g1', 'g2'], 'emergency-run');
    expect(new Set(plan.flatMap((entry) => entry.abilityTags))).toEqual(new Set(BUNKER_ABILITY_TAGS));
  });
});
