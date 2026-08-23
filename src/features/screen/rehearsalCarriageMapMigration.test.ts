// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823202000_rehearsal_guests_carriage_map.sql`,
  'utf8',
).replace(/\s+/g, ' ').toLowerCase();

describe('rehearsal carriage map', () => {
  it('includes synthetic guests before a run and during explicit test mode', () => {
    expect(migration).toContain("guest.affiliation_detail = '__bunker_test__'");
    expect(migration).toContain("v_game_mode = 'test'");
    expect(migration).toContain('v_run_nonce is null');
    expect(migration).toContain('v_include_test');
  });

  it('keeps the production-run filter for synthetic rehearsal guests', () => {
    expect(migration).toContain("v_include_test or guest.affiliation_detail is distinct from '__bunker_test__'");
  });

  it('uses the rehearsal population as the completion target when test guests are visible', () => {
    expect(migration).toContain('v_map_expected_guest_count');
    expect(migration).toContain('v_registered_guest_count');
  });
});
