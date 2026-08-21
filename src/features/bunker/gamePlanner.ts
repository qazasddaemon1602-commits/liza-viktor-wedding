export const BUNKER_ABILITY_TAGS = [
  'technical',
  'medical',
  'communication',
  'bunker_knowledge',
  'analytical',
] as const;

export type BunkerAbilityTag = typeof BUNKER_ABILITY_TAGS[number];
export type FinalParameter = 'coordinates' | 'sector' | 'code' | 'gateway_time' | 'password';

export type ProtocolFragmentPlan = {
  wagonId: string;
  fragmentIndex: number;
  totalFragments: number;
  requiredWagonIds: string[];
};

export type FinalInformationPlan = {
  wagonId: string;
  parameter: FinalParameter;
  part: number;
  totalParts: number;
};

export type GuestAbilityPlan = {
  guestId: string;
  abilityTags: BunkerAbilityTag[];
};

function assertActiveWagons(wagonIds: readonly string[]): void {
  if (wagonIds.length < 2 || wagonIds.length > 5) {
    throw new RangeError('Bunker requires between two and five active wagons');
  }
  if (new Set(wagonIds).size !== wagonIds.length || wagonIds.some((id) => !id.trim())) {
    throw new Error('Active wagon ids must be unique and non-empty');
  }
}

export function missionOneExclusionCount(wagonSize: number): number {
  if (!Number.isInteger(wagonSize) || wagonSize < 0) throw new RangeError('Wagon size cannot be negative');
  if (wagonSize === 0) return 0;
  if (wagonSize >= 10) return 3;
  if (wagonSize >= 7) return 2;
  return 1;
}

export function buildCommunicationGroups(wagonIds: readonly string[]): string[][] {
  assertActiveWagons(wagonIds);
  if (wagonIds.length <= 3) return [[...wagonIds]];
  if (wagonIds.length === 4) {
    return [[wagonIds[0], wagonIds[2]], [wagonIds[1], wagonIds[3]]];
  }
  return [[wagonIds[0], wagonIds[1]], [wagonIds[2], wagonIds[3], wagonIds[4]]];
}

export function buildProtocolFragmentPlan(wagonIds: readonly string[]): ProtocolFragmentPlan[] {
  assertActiveWagons(wagonIds);
  return wagonIds.map((wagonId, index) => ({
    wagonId,
    fragmentIndex: index + 1,
    totalFragments: wagonIds.length,
    requiredWagonIds: wagonIds.filter((candidate) => candidate !== wagonId),
  }));
}

function entry(
  wagonId: string,
  parameter: FinalParameter,
  part = 1,
  totalParts = 1,
): FinalInformationPlan {
  return { wagonId, parameter, part, totalParts };
}

export function buildFinalInformationPlan(wagonIds: readonly string[]): FinalInformationPlan[] {
  assertActiveWagons(wagonIds);
  if (wagonIds.length === 2) {
    return [
      entry(wagonIds[0], 'sector'),
      entry(wagonIds[0], 'coordinates', 1, 2),
      entry(wagonIds[0], 'code'),
      entry(wagonIds[1], 'coordinates', 2, 2),
      entry(wagonIds[1], 'gateway_time'),
      entry(wagonIds[1], 'password'),
    ];
  }
  if (wagonIds.length === 3) {
    return [
      entry(wagonIds[0], 'coordinates', 1, 2),
      entry(wagonIds[0], 'code', 1, 2),
      entry(wagonIds[1], 'sector'),
      entry(wagonIds[1], 'gateway_time'),
      entry(wagonIds[2], 'coordinates', 2, 2),
      entry(wagonIds[2], 'code', 2, 2),
      entry(wagonIds[2], 'password'),
    ];
  }

  const units: Array<Omit<FinalInformationPlan, 'wagonId'>> = [
    { parameter: 'coordinates', part: 1, totalParts: 2 },
    { parameter: 'sector', part: 1, totalParts: 1 },
    { parameter: 'code', part: 1, totalParts: 2 },
    { parameter: 'gateway_time', part: 1, totalParts: 1 },
    { parameter: 'password', part: 1, totalParts: 1 },
    { parameter: 'coordinates', part: 2, totalParts: 2 },
    { parameter: 'code', part: 2, totalParts: 2 },
  ];
  return units.map((unit, index) => ({
    wagonId: wagonIds[index % wagonIds.length],
    ...unit,
  }));
}

function seedNumber(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string): () => number {
  let state = seedNumber(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildControlledAbilityPlan(
  guestIds: readonly string[],
  runSeed: string,
): GuestAbilityPlan[] {
  if (!guestIds.length) return [];
  if (!runSeed.trim()) throw new Error('Controlled random requires a run seed');
  if (new Set(guestIds).size !== guestIds.length || guestIds.some((id) => !id.trim())) {
    throw new Error('Guest ids must be unique and non-empty');
  }

  const random = seededRandom(runSeed);
  const shuffled = [...guestIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  const abilities = new Map(guestIds.map((guestId) => [guestId, [] as BunkerAbilityTag[]]));
  BUNKER_ABILITY_TAGS.forEach((tag, index) => {
    abilities.get(shuffled[index % shuffled.length])?.push(tag);
  });
  shuffled.forEach((guestId) => {
    const assigned = abilities.get(guestId);
    if (assigned && assigned.length === 0) {
      assigned.push(BUNKER_ABILITY_TAGS[Math.floor(random() * BUNKER_ABILITY_TAGS.length)]);
    }
  });

  return guestIds.map((guestId) => ({ guestId, abilityTags: abilities.get(guestId) ?? [] }));
}
