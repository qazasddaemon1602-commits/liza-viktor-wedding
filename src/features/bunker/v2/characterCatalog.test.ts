import { describe, expect, it } from 'vitest';
import { EXPECTED_CHARACTER_CATALOG } from './characterCatalog.expected';
import { BUNKER_CHARACTER_CATALOG, CHARACTER_CATALOG_VERSION } from './characterCatalog';

describe('Bunker V2 character catalog', () => {
  it('matches the approved 36-profile fixture without guest names', () => {
    expect(CHARACTER_CATALOG_VERSION).toBe(2);
    expect(BUNKER_CHARACTER_CATALOG).toEqual(EXPECTED_CHARACTER_CATALOG);
    expect(new Set(BUNKER_CHARACTER_CATALOG.map((profile) => profile.key)).size).toBe(36);
    expect(BUNKER_CHARACTER_CATALOG.every((profile) => !('name' in profile))).toBe(true);
  });
});
