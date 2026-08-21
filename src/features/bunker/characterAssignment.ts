import { BUNKER_CHARACTER_PROFILES, type BunkerCharacterProfile } from './characterPool';
import { CHARACTER_CATEGORY_KEYS } from './v2/characterCatalog';

export type CharacterAssignment = { guestId: string; profileKey: string };
export type CharacterCategory = keyof typeof CHARACTER_CATEGORY_KEYS;
export type CharacterCategoryCounts = Record<CharacterCategory, number>;

const categories = Object.keys(CHARACTER_CATEGORY_KEYS) as CharacterCategory[];
const LEGACY_CHARACTER_CATEGORY_KEYS: Record<CharacterCategory, readonly string[]> = {
  technical: ['power_engineer', 'electrician', 'mechanic', 'military_engineer'],
  medical: ['surgeon', 'paramedic'],
  information: ['cybersecurity_specialist', 'programmer', 'student'],
  communication: ['signal_operator', 'radio_amateur', 'diplomat', 'psychologist'],
  bunker: ['unemployed', 'architect', 'security_guard', 'journalist', 'military_engineer'],
  navigation: ['geologist', 'cartographer', 'train_driver', 'driver'],
  analytical: [
    'cartographer', 'cybersecurity_specialist', 'logistician', 'chemist', 'biologist',
    'architect', 'lawyer', 'journalist', 'teacher', 'astronomer',
  ],
};

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

function quotaTiers(guestCount: number): Array<[CharacterCategory, number]> {
  if (guestCount <= 18) return [['technical', 2], ['medical', 1], ['information', 1], ['communication', 2], ['analytical', 2], ['bunker', 1], ['navigation', 1]];
  if (guestCount <= 20) return [['technical', 2], ['medical', 2], ['information', 1], ['communication', 2], ['analytical', 2], ['bunker', 1], ['navigation', 1]];
  return [['technical', 3], ['medical', 2], ['information', 2], ['communication', 3], ['analytical', 3], ['bunker', 2], ['navigation', 2]];
}

function hasCategory(profile: BunkerCharacterProfile, category: CharacterCategory): boolean {
  return (CHARACTER_CATEGORY_KEYS[category] as readonly string[]).includes(profile.key);
}

function legacyIsCategory(profile: BunkerCharacterProfile, category: CharacterCategory): boolean {
  return LEGACY_CHARACTER_CATEGORY_KEYS[category].includes(profile.key);
}

function validateGuests(guestIds: readonly string[], runNonce: string): void {
  if (!runNonce.trim()) throw new Error('Character assignment requires a run seed');
  if (new Set(guestIds).size !== guestIds.length || guestIds.some((id) => !id.trim())) {
    throw new Error('Guest ids must be unique and non-empty');
  }
}

function selectedUniqueProfiles(
  count: number,
  random: () => number,
  tiers = quotaTiers(count),
): BunkerCharacterProfile[] {
  const shuffled = shuffle(BUNKER_CHARACTER_PROFILES, random);
  const selected: BunkerCharacterProfile[] = [];
  const selectedKeys = new Set<string>();
  for (const [category, minimum] of tiers) {
    while (selected.filter((profile) => hasCategory(profile, category)).length < minimum) {
      const profile = shuffled.find((candidate) => !selectedKeys.has(candidate.key) && hasCategory(candidate, category));
      if (!profile) throw new Error(`Character pool cannot cover ${category}`);
      selected.push(profile);
      selectedKeys.add(profile.key);
    }
  }
  for (const profile of shuffled) {
    if (selected.length === Math.min(count, shuffled.length)) break;
    if (!selectedKeys.has(profile.key)) {
      selected.push(profile);
      selectedKeys.add(profile.key);
    }
  }
  return selected;
}

function legacyQuotas(guestCount: number): Array<[CharacterCategory, number]> {
  if (guestCount >= 15 && guestCount <= 20) {
    return [
      ['technical', 2], ['medical', guestCount >= 18 ? 2 : 1], ['information', 1],
      ['communication', 2], ['bunker', 1], ['navigation', 1], ['analytical', 2],
    ];
  }
  return [
    ['technical', 1], ['medical', 1], ['information', 1], ['communication', 1],
    ['bunker', 1], ['navigation', 1],
  ];
}

function assignLegacyCharacters(guestIds: readonly string[], runSeed: string): CharacterAssignment[] {
  const random = seededRandom(runSeed);
  const shuffledProfiles = shuffle(BUNKER_CHARACTER_PROFILES, random);
  const selected: BunkerCharacterProfile[] = [];
  const selectedKeys = new Set<string>();

  for (const [category, targetCount] of legacyQuotas(guestIds.length)) {
    while (selected.filter((profile) => legacyIsCategory(profile, category)).length < targetCount) {
      const candidate = shuffledProfiles.find(
        (profile) => !selectedKeys.has(profile.key) && legacyIsCategory(profile, category),
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

function maximizedSeparatedRepeats(
  repeatGuestIds: readonly string[],
  profiles: readonly BunkerCharacterProfile[],
  primaryByKey: ReadonlyMap<string, string>,
  wagonByGuest: ReadonlyMap<string, string>,
  random: () => number,
): Array<string | undefined> {
  const candidates = shuffle(profiles, random);
  type Match = { profileKeys: Array<string | undefined>; separatedCount: number };
  const search = (index: number, used: ReadonlySet<string>): Match => {
    if (index === repeatGuestIds.length) return { profileKeys: [], separatedCount: 0 };
    const guestId = repeatGuestIds[index];
    const skipped = search(index + 1, used);
    let best: Match = { profileKeys: [undefined, ...skipped.profileKeys], separatedCount: skipped.separatedCount };
    for (const profile of candidates) {
      if (used.has(profile.key)) continue;
      const primaryGuestId = primaryByKey.get(profile.key);
      if (wagonByGuest.get(primaryGuestId as string) === wagonByGuest.get(guestId)) continue;
      const remaining = search(index + 1, new Set([...used, profile.key]));
      const candidate: Match = {
        profileKeys: [profile.key, ...remaining.profileKeys],
        separatedCount: remaining.separatedCount + 1,
      };
      if (candidate.separatedCount > best.separatedCount) best = candidate;
    }
    return best;
  };
  return search(0, new Set()).profileKeys;
}

export function assignV2Characters(guestIds: readonly string[], wagonByGuest: ReadonlyMap<string, string>, runNonce: string): CharacterAssignment[] {
  validateGuests(guestIds, runNonce);
  if (guestIds.length === 0) return [];
  if (guestIds.length < 15 || guestIds.length > 40) throw new Error('V2 character assignment supports 15 to 40 guests');
  if (guestIds.some((guestId) => !wagonByGuest.get(guestId)?.trim())) throw new Error('Every V2 guest requires a wagon');

  const random = seededRandom(runNonce);
  const selected = selectedUniqueProfiles(guestIds.length, random);
  const uniqueCount = Math.min(guestIds.length, BUNKER_CHARACTER_PROFILES.length);
  const uniqueGuestIds = shuffle(guestIds.slice(0, uniqueCount), random);
  const assignments = selected.map((profile, index) => ({ guestId: uniqueGuestIds[index], profileKey: profile.key }));
  const primaryByKey = new Map(assignments.map((assignment) => [assignment.profileKey, assignment.guestId]));
  const repeatGuestIds = guestIds.slice(uniqueCount);
  const separatedRepeats = maximizedSeparatedRepeats(
    repeatGuestIds, selected.slice(0, uniqueCount), primaryByKey, wagonByGuest, random,
  );
  const repeated = new Set<string>();
  const reservedSeparatedKeys = new Set(separatedRepeats.filter((profileKey): profileKey is string => Boolean(profileKey)));

  for (let index = 0; index < repeatGuestIds.length; index += 1) {
    const guestId = repeatGuestIds[index];
    const candidates = shuffle(selected.slice(0, uniqueCount), random);
    const profileKey = separatedRepeats?.[index]
      ?? candidates.find((profile) => !repeated.has(profile.key) && !reservedSeparatedKeys.has(profile.key))?.key;
    if (!profileKey) throw new Error('Character pool cannot provide distinct controlled repeats');
    repeated.add(profileKey);
    assignments.push({ guestId, profileKey });
  }
  const profileKeyByGuest = new Map(assignments.map((assignment) => [assignment.guestId, assignment.profileKey]));
  return guestIds.map((guestId) => ({ guestId, profileKey: profileKeyByGuest.get(guestId) as string }));
}

export function assignCharacterProfiles(guestIds: readonly string[], runSeed: string): CharacterAssignment[] {
  validateGuests(guestIds, runSeed);
  if (guestIds.length === 0) return [];
  return assignLegacyCharacters(guestIds, runSeed);
}

function categoryCounts(
  assignments: readonly CharacterAssignment[],
  categoryKeys: Record<CharacterCategory, readonly string[]>,
): CharacterCategoryCounts {
  const result = Object.fromEntries(categories.map((category) => [category, 0])) as CharacterCategoryCounts;
  for (const { profileKey } of assignments) {
    for (const category of categories) if (categoryKeys[category].includes(profileKey)) result[category] += 1;
  }
  return result;
}

export function characterCategoryCounts(assignments: readonly CharacterAssignment[]): CharacterCategoryCounts {
  return categoryCounts(assignments, LEGACY_CHARACTER_CATEGORY_KEYS);
}

export function v2CharacterCategoryCounts(assignments: readonly CharacterAssignment[]): CharacterCategoryCounts {
  return categoryCounts(assignments, CHARACTER_CATEGORY_KEYS);
}
