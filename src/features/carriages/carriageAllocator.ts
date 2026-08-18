export type AffiliationKey = 'liza' | 'viktor' | 'common' | 'family' | 'colleagues' | 'other';

export type AllocationSnapshot = {
  id: string;
  number: number;
  total: number;
  affiliations: Record<AffiliationKey, number>;
};

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
