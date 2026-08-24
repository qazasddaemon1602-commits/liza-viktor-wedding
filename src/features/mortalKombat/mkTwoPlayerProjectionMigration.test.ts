// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };

const migrationPath = resolve(
  runtime.process.cwd(),
  'supabase/migrations/20260825012000_mortal_kombat_two_player_projection.sql',
);

describe('MK two-player production projection migration', () => {
  it('keeps public and owner match projections boolean when no bout is selected', () => {
    expect(existsSync(migrationPath), 'MK compatibility migration must exist').toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/coalesce\s*\(\s*\(\s*match_item->>'current'\s*\)::boolean\s*,\s*false\s*\)/i);
    expect(sql.match(/public\._normalize_mk_current_flags\s*\(/gi)?.length).toBeGreaterThanOrEqual(3);
  });

  it('selects the first real ready bout when finalizing the draw', () => {
    expect(existsSync(migrationPath), 'MK compatibility migration must exist').toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();

    expect(sql).toContain("where m.tournament_id = v_tournament.id and m.status = 'ready' and m.player1_guest_id is not null and m.player2_guest_id is not null");
    expect(sql).toContain('current_match_id = v_first_ready_match_id');
  });
});
