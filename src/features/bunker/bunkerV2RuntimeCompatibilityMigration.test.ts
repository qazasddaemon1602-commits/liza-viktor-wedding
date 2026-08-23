// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823204000_bunker_v2_runtime_contract_compat.sql`,
  'utf8',
).replace(/\s+/g, ' ').toLowerCase();

describe('Bunker V2 runtime contract compatibility', () => {
  it('returns the strict V2 payload before legacy mission-action enrichment', () => {
    expect(migration).toContain('create or replace function public._get_guest_bunker_runtime_before_character_abilities');
    expect(migration).toContain("if v_result->>'contractversion' = '2' then return v_result; end if");
  });

  it('returns the strict V2 payload before legacy character-ability enrichment', () => {
    expect(migration).toContain('create or replace function public.get_guest_bunker_runtime');
    expect(migration.match(/if v_result->>'contractversion' = '2' then return v_result; end if/g)?.length)
      .toBe(2);
  });

  it('keeps legacy enrichments intact for V1 runtimes', () => {
    expect(migration).toContain("'{character,abilityaction}'");
    expect(migration).toContain("'{wagonstate,abilitymodifiers}'");
    expect(migration).toContain("'missionaction'");
  });
});
