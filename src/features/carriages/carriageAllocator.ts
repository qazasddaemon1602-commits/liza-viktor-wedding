export type AffiliationKey = 'liza' | 'viktor' | 'common' | 'family' | 'colleagues' | 'other';

export type AllocationSnapshot = {
  id: string;
  number: number;
  total: number;
  affiliations: Record<AffiliationKey, number>;
};

export type SupportedCarriageCount = 2 | 3 | 4 | 5;

export function recommendCarriageCount(guestCount: number): SupportedCarriageCount {
  if (guestCount <= 18) return 2;
  if (guestCount <= 26) return 3;
  if (guestCount <= 36) return 4;
  return 5;
}

export function balancedCarriageSizes(
  guestCount: number,
  carriageCount: number,
): number[] {
  if (!Number.isInteger(carriageCount) || carriageCount < 2 || carriageCount > 5) {
    throw new Error('Carriage count must be between 2 and 5');
  }
  if (!Number.isInteger(guestCount) || guestCount < 0) {
    throw new Error('Guest count must be a non-negative integer');
  }

  const smallerTeamSize = Math.floor(guestCount / carriageCount);
  const largerTeamCount = guestCount % carriageCount;
  return Array.from(
    { length: carriageCount },
    (_, index) => smallerTeamSize + (index < largerTeamCount ? 1 : 0),
  );
}

export function chooseCarriage(
  snapshots: readonly AllocationSnapshot[],
  affiliation: AffiliationKey,
  random: () => number = Math.random,
): AllocationSnapshot {
  if (snapshots.length === 0) {
    throw new Error('No enabled carriages available');
  }

  const minTotal = Math.min(...snapshots.map((item) => item.total));
  const leastPopulated = snapshots.filter((item) => item.total === minTotal);
  const minAffiliationCount = Math.min(
    ...leastPopulated.map((item) => item.affiliations[affiliation]),
  );
  const bestDiversity = leastPopulated.filter(
    (item) => item.affiliations[affiliation] === minAffiliationCount,
  );

  const index = Math.min(
    bestDiversity.length - 1,
    Math.floor(Math.max(0, Math.min(0.999999, random())) * bestDiversity.length),
  );

  return bestDiversity[index];
}
