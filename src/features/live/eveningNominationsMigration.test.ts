// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824023500_wedding_evening_nominations.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('evening nominations migration', () => {
  it('excludes rehearsal guests from personal awards', () => {
    expect(sql).toContain("coalesce(g.affiliation_detail, '') <> '__BUNKER_TEST__'");
  });

  it('uses real tournament and Bunker outcomes', () => {
    expect(sql).toContain('champion_guest_id');
    expect(sql).toContain("i.mission_code in ('MISSION_01','MISSION_02','MISSION_03','MISSION_05')");
    expect(sql).toContain('where p.completed_count = 4');
    expect(sql).toContain("'4/4 ВАГОННЫХ МИССИЙ · ПЕРВЫМ ДО ФИНИША'");
    expect(sql).toContain("i.mission_code = 'MISSION_02'");
    expect(sql).toContain('i.completed_at is not null');
  });

  it('publishes only the nominations actually found', () => {
    expect(sql).toContain("'evening_nominations'");
    expect(sql).toContain("now() + interval '45 seconds'");
    expect(sql).toContain("'status', 'empty'");
  });
});
