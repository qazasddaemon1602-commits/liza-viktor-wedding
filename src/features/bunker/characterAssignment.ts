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

export function assignV2Characters(guestIds: readonly string[], wagonByGuest: ReadonlyMap<string, string>, runNonce: string): CharacterAssignment[] {
  validateGuests(guestIds, runNonce);
  if (guestIds.length === 0) return [];
  if (guestIds.length < 15 || guestIds.length > 40) throw new Error('V2 character assignment supports 15 to 40 guests');
  if (guestIds.some((guestId) => !wagonByGuest.get(guestId)?.trim())) throw new Error('Every V2 guest requires a wagon');

  const random = seededRandom(runNonce);
  const selected = selectedUniqueProfiles(guestIds.length, random);
  const uniqueCount = Math.min(guestIds.length, BUNKER_CHARACTER_PROFILES.length);
  const assignments = selected.map((profile, index) => ({ guestId: guestIds[index], profileKey: profile.key }));
  const repeated = new Set<string>();
  const primaryByKey = new Map(assignments.map((assignment) => [assignment.profileKey, assignment.guestId]));

  for (let index = uniqueCount; index < guestIds.length; index += 1) {
    const guestId = guestIds[index];
    const candidates = shuffle(selected.slice(0, uniqueCount), random);
    const separated = candidates.find((profile) => !repeated.has(profile.key)
      && wagonByGuest.get(primaryByKey.get(profile.key) as string) !== wagonByGuest.get(guestId));
    const repeat = separated ?? candidates.find((profile) => !repeated.has(profile.key));
    if (!repeat) throw new Error('Character pool cannot provide distinct controlled repeats');
    repeated.add(repeat.key);
    assignments.push({ guestId, profileKey: repeat.key });
  }
  return assignments;
}

export function assignCharacterProfiles(guestIds: readonly string[], runSeed: string): CharacterAssignment[] {
  validateGuests(guestIds, runSeed);
  if (guestIds.length === 0) return [];
  if (guestIds.length >= 15 && guestIds.length <= 40 && guestIds.length !== 18) {
    return assignV2Characters(guestIds, new Map(guestIds.map((guestId) => [guestId, 'legacy'])), runSeed);
  }
  const random = seededRandom(runSeed);
  const legacyTiers: Array<[CharacterCategory, number]> = [
    ['technical', guestIds.length <= 20 ? 2 : 1],
    ['medical', guestIds.length >= 18 && guestIds.length <= 20 ? 2 : 1],
    ['information', 1],
    ['communication', guestIds.length <= 20 ? 2 : 1],
    ['bunker', 1],
    ['navigation', 1],
    ['analytical', guestIds.length <= 20 ? 2 : 0],
  ];
  const selected = selectedUniqueProfiles(Math.min(guestIds.length, 36), random, legacyTiers);
  while (selected.length < guestIds.length) selected.push(...shuffle(BUNKER_CHARACTER_PROFILES, random));
  return selected.slice(0, guestIds.length).map((profile, index) => ({ guestId: guestIds[index], profileKey: profile.key }));
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
