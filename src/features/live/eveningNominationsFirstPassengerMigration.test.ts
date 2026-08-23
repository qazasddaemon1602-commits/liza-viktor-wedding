// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824023800_fix_evening_nominations_first_passenger.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('first passenger nomination repair', () => {
  it('treats leading underscores literally instead of LIKE wildcards', () => {
    expect(sql).toContain("left(g.first_name, 2) <> '__'");
    expect(sql).not.toContain("g.first_name not like '__%'");
  });

  it('keeps rehearsal guests excluded while allowing ordinary names', () => {
    expect(sql).toContain("coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'");
    expect(sql).toContain("'key', 'first_passenger'");
  });
});
