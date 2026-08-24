// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824070000_registration_carriage_full_names.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('registration carriage full-name migration', () => {
  it('adds a safe fullName while retaining initials for rolling deploy compatibility', () => {
    expect(sql).toContain("'fullName'");
    expect(sql).toContain("pg_catalog.concat_ws(' ',");
    expect(sql).toContain("pg_catalog.btrim(guest.first_name)");
    expect(sql).toContain("pg_catalog.btrim(guest.last_name)");
    expect(sql).toContain("'initials'");
    expect(sql).toContain("'seatIndex'");
  });

  it('preserves test-guest visibility rules and public read access', () => {
    expect(sql).toContain("guest.affiliation_detail = '__BUNKER_TEST__'");
    expect(sql).toContain("v_game_mode = 'test' or v_run_nonce is null");
    expect(sql).toContain('grant execute on function public.get_registration_carriage_map(text) to anon, authenticated');
  });
});
