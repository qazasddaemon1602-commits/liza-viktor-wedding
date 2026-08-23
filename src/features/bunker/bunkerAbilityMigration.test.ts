// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${testRuntime.process.cwd()}/supabase/migrations/20260823035000_bunker_character_ability_action.sql`,
  'utf8',
);

describe('Bunker character ability migration safety', () => {
  it('guards the partial unique index on migration replay', () => {
    expect(migration).toMatch(
      /create unique index if not exists bunker_character_ability_action_unique/i,
    );
  });

  it('renames runtime and submit implementations only once', () => {
    expect(migration).toMatch(
      /to_regprocedure\(\s*'public\._get_guest_bunker_runtime_before_character_abilities\(text,text\)'/i,
    );
    expect(migration).toMatch(
      /to_regprocedure\(\s*'public\._submit_guest_bunker_global_mission_before_ability_modifiers\(text,text,text,jsonb\)'/i,
    );
  });
});
