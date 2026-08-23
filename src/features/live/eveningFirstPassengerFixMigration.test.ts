// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824023600_fix_evening_first_passenger.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('first passenger nomination fix', () => {
  it('treats double underscore as a literal test-name prefix, not LIKE wildcards', () => {
    expect(sql).toContain("left(g.first_name, 2) <> '__'");
    expect(sql).not.toContain("g.first_name not like '__%'");
  });

  it('preserves the four fact-backed nomination sources', () => {
    expect(sql).toContain("'first_passenger'");
    expect(sql).toContain("'mk_champion'");
    expect(sql).toContain("'steadfast_wagon'");
    expect(sql).toContain("'detective_wagon'");
    expect(sql).toContain('where p.completed_count = 4');
  });
});
