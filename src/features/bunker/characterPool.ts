import { BUNKER_CHARACTER_CATALOG } from './v2/characterCatalog';

export type BunkerCharacterProfile = {
  key: string;
  profession: string;
  health: string;
  visibleSkill: string;
  hiddenTrait: string;
  specialAbility: string;
  abilityDescription: string;
  tags: readonly string[];
};

export const BUNKER_CHARACTER_PROFILES: readonly BunkerCharacterProfile[] = BUNKER_CHARACTER_CATALOG;

export type CharacterPoolValidation = { valid: boolean; errors: string[] };

export function validateCharacterPool(
  profiles: readonly BunkerCharacterProfile[],
): CharacterPoolValidation {
  const errors: string[] = [];
  const keys = new Set<string>();
  const professions = new Set<string>();

  for (const current of profiles) {
    if (keys.has(current.key)) errors.push(`Duplicate character key: ${current.key}`);
    if (professions.has(current.profession)) errors.push(`Duplicate profession: ${current.profession}`);
    keys.add(current.key);
    professions.add(current.profession);
    if (!current.key || !current.profession || !current.health || !current.visibleSkill
      || !current.hiddenTrait || !current.specialAbility || !current.abilityDescription
      || current.tags.length === 0) {
      errors.push(`Incomplete character profile: ${current.key || '<empty>'}`);
    }
  }

  if (profiles.length !== 36) errors.push(`Expected 36 profiles, received ${profiles.length}`);
  return { valid: errors.length === 0, errors };
}
