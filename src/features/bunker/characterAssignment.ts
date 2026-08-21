import { BUNKER_CHARACTER_PROFILES, type BunkerCharacterProfile } from './characterPool';
import { CHARACTER_CATEGORY_KEYS } from './v2/characterCatalog';

export type CharacterAssignment = { guestId: string; profileKey: string };
export type CharacterCategory = keyof typeof CHARACTER_CATEGORY_KEYS;
export type CharacterCategoryCounts = Record<CharacterCategory, number>;

const categories = Object.keys(CHARACTER_CATEGORY_KEYS) as CharacterCategory[];

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
  switch (category) {
    case 'technical': return ['power_engineer', 'electrician', 'mechanic', 'military_engineer'].includes(profile.key);
    case 'medical': return profile.tags.includes('medicine');
    case 'information': return ['cybersecurity_specialist', 'programmer', 'student'].includes(profile.key);
    case 'communication': return profile.tags.includes('communication');
    case 'bunker': return profile.specialAbility === 'bunker_knowledge' || profile.tags.includes('bunker');
    case 'navigation': return ['geologist', 'cartographer', 'train_driver', 'driver'].includes(profile.key);
    case 'analytical': return profile.tags.includes('analysis');
  }
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

function matchedSeparatedRepeats(
  repeatGuestIds: readonly string[],
  profiles: readonly BunkerCharacterProfile[],
  primaryByKey: ReadonlyMap<string, string>,
  wagonByGuest: ReadonlyMap<string, string>,
  random: () => number,
): string[] | undefined {
  const candidates = shuffle(profiles, random);
  const search = (index: number, used: ReadonlySet<string>): string[] | undefined => {
    if (index === repeatGuestIds.length) return [];
    const guestId = repeatGuestIds[index];
    for (const profile of candidates) {
      if (used.has(profile.key)) continue;
      const primaryGuestId = primaryByKey.get(profile.key);
      if (wagonByGuest.get(primaryGuestId as string) === wagonByGuest.get(guestId)) continue;
      const remaining = search(index + 1, new Set([...used, profile.key]));
      if (remaining) return [profile.key, ...remaining];
    }
    return undefined;
  };
  return search(0, new Set());
}

export function assignV2Characters(guestIds: readonly string[], wagonByGuest: ReadonlyMap<string, string>, runNonce: string): CharacterAssignment[] {
  validateGuests(guestIds, runNonce);
  if (guestIds.length === 0) return [];
  if (guestIds.length < 15 || guestIds.length > 40) throw new Error('V2 character assignment supports 15 to 40 guests');
  if (guestIds.some((guestId) => !wagonByGuest.get(guestId)?.trim())) throw new Error('Every V2 guest requires a wagon');

  const random = seededRandom(runNonce);
  const selected = selectedUniqueProfiles(guestIds.length, random);
  const uniqueCount = Math.min(guestIds.length, BUNKER_CHARACTER_PROFILES.length);
  const assignments = selected.map((profile, index) => ({ guestId: guestIds[index], profileKey: profile.key }));
  const primaryByKey = new Map(assignments.map((assignment) => [assignment.profileKey, assignment.guestId]));
  const repeatGuestIds = guestIds.slice(uniqueCount);
  const separatedRepeats = matchedSeparatedRepeats(
    repeatGuestIds, selected.slice(0, uniqueCount), primaryByKey, wagonByGuest, random,
  );
  const repeated = new Set<string>();

  for (let index = 0; index < repeatGuestIds.length; index += 1) {
    const guestId = repeatGuestIds[index];
    const candidates = shuffle(selected.slice(0, uniqueCount), random);
    const profileKey = separatedRepeats?.[index]
      ?? candidates.find((profile) => !repeated.has(profile.key))?.key;
    if (!profileKey) throw new Error('Character pool cannot provide distinct controlled repeats');
    repeated.add(profileKey);
    assignments.push({ guestId, profileKey });
  }
  return assignments;
}

export function assignCharacterProfiles(guestIds: readonly string[], runSeed: string): CharacterAssignment[] {
  validateGuests(guestIds, runSeed);
  if (guestIds.length === 0) return [];
  return assignLegacyCharacters(guestIds, runSeed);
}

export function characterCategoryCounts(assignments: readonly CharacterAssignment[]): CharacterCategoryCounts {
  const result = Object.fromEntries(categories.map((category) => [category, 0])) as CharacterCategoryCounts;
  const profiles = new Map(BUNKER_CHARACTER_PROFILES.map((profile) => [profile.key, profile]));
  for (const { profileKey } of assignments) {
    const profile = profiles.get(profileKey);
    if (!profile) continue;
    for (const category of categories) if (hasCategory(profile, category)) result[category] += 1;
  }
  return result;
}
