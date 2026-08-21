import {
  BUNKER_CHARACTER_PROFILES,
  type BunkerCharacterProfile,
} from './characterPool';

export type CharacterAssignment = {
  guestId: string;
  profileKey: string;
};

export type CharacterCategory =
  | 'technical'
  | 'medical'
  | 'information'
  | 'communication'
  | 'bunker'
  | 'navigation'
  | 'analytical';

export type CharacterCategoryCounts = Record<CharacterCategory, number>;

const TECHNICAL_KEYS = new Set([
  'power_engineer', 'electrician', 'mechanic', 'military_engineer',
]);
const INFORMATION_KEYS = new Set([
  'cybersecurity_specialist', 'programmer', 'student',
]);
const NAVIGATION_KEYS = new Set([
  'geologist', 'cartographer', 'train_driver', 'driver',
]);

function isCategory(profile: BunkerCharacterProfile, category: CharacterCategory): boolean {
  switch (category) {
    case 'technical': return TECHNICAL_KEYS.has(profile.key);
    case 'medical': return profile.tags.includes('medicine');
    case 'information': return INFORMATION_KEYS.has(profile.key);
    case 'communication': return profile.tags.includes('communication');
    case 'bunker': return profile.specialAbility === 'bunker_knowledge' || profile.tags.includes('bunker');
    case 'navigation': return NAVIGATION_KEYS.has(profile.key);
    case 'analytical': return profile.tags.includes('analysis');
  }
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

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function quotas(guestCount: number): Array<[CharacterCategory, number]> {
  if (guestCount >= 15 && guestCount <= 20) {
    return [
      ['technical', 2],
      ['medical', guestCount >= 18 ? 2 : 1],
      ['information', 1],
      ['communication', 2],
      ['bunker', 1],
      ['navigation', 1],
      ['analytical', 2],
    ];
  }
  return [
    ['technical', 1],
    ['medical', 1],
    ['information', 1],
    ['communication', 1],
    ['bunker', 1],
    ['navigation', 1],
  ];
}

export function assignCharacterProfiles(
  guestIds: readonly string[],
  runSeed: string,
): CharacterAssignment[] {
  if (!runSeed.trim()) throw new Error('Character assignment requires a run seed');
  if (new Set(guestIds).size !== guestIds.length || guestIds.some((id) => !id.trim())) {
    throw new Error('Guest ids must be unique and non-empty');
  }
  if (guestIds.length === 0) return [];

  const random = seededRandom(runSeed);
  const shuffledProfiles = shuffle(BUNKER_CHARACTER_PROFILES, random);
  const selected: BunkerCharacterProfile[] = [];
  const selectedKeys = new Set<string>();

  for (const [category, targetCount] of quotas(guestIds.length)) {
    while (selected.filter((profile) => isCategory(profile, category)).length < targetCount) {
      const candidate = shuffledProfiles.find(
        (profile) => !selectedKeys.has(profile.key) && isCategory(profile, category),
      );
      if (!candidate) throw new Error(`Character pool cannot cover ${category}`);
      selected.push(candidate);
      selectedKeys.add(candidate.key);
    }
  }

  for (const candidate of shuffledProfiles) {
    if (selected.length >= Math.min(guestIds.length, shuffledProfiles.length)) break;
    if (selectedKeys.has(candidate.key)) continue;
    selected.push(candidate);
    selectedKeys.add(candidate.key);
  }

  if (guestIds.length > selected.length) {
    for (const candidate of shuffle(shuffledProfiles, random)) {
      if (selected.length >= guestIds.length) break;
      selected.push(candidate);
    }
  }

  const shuffledGuests = shuffle(guestIds, random);
  const byGuest = new Map<string, string>();
  shuffledGuests.forEach((guestId, index) => byGuest.set(guestId, selected[index].key));
  return guestIds.map((guestId) => ({ guestId, profileKey: byGuest.get(guestId) as string }));
}

export function characterCategoryCounts(
  assignments: readonly CharacterAssignment[],
): CharacterCategoryCounts {
  const result: CharacterCategoryCounts = {
    technical: 0,
    medical: 0,
    information: 0,
    communication: 0,
    bunker: 0,
    navigation: 0,
    analytical: 0,
  };
  const byKey = new Map(BUNKER_CHARACTER_PROFILES.map((profile) => [profile.key, profile]));
  for (const assignment of assignments) {
    const assigned = byKey.get(assignment.profileKey);
    if (!assigned) continue;
    (Object.keys(result) as CharacterCategory[]).forEach((category) => {
      if (isCategory(assigned, category)) result[category] += 1;
    });
  }
  return result;
}
