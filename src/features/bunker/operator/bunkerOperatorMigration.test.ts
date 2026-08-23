// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823043000_bunker_route_story_and_operator_idempotency.sql`,
  'utf8',
);
const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

describe('Bunker route story and operator retry migration', () => {
  it('keeps the submit override hardened and resolves a stored choice before expiry', () => {
    const start = normalized.indexOf(
      'create or replace function public.submit_liza_bunker_operator_phrase',
    );
    const end = normalized.indexOf(
      'revoke all on function public.submit_liza_bunker_operator_phrase',
      start,
    );
    const submit = normalized.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(submit).toContain("security definer set search_path = ''");
    expect(submit.indexOf('from public.final_five_role_access')).toBeLessThan(
      submit.indexOf('from public.bunker_state'),
    );
    expect(submit).toContain('for update');
    expect(submit).toContain('for share');
    expect(submit.indexOf('if v_message.id is not null')).toBeLessThan(
      submit.indexOf('operator send window is closed'),
    );
  });

  it('adds only narrative route fields for all existing mission identifiers', () => {
    const storyStart = normalized.indexOf(
      'create or replace function public._bunker_route_story_definition',
    );
    const storyEnd = normalized.indexOf(
      'revoke all on function public._bunker_route_story_definition',
      storyStart,
    );
    const story = normalized.slice(storyStart, storyEnd);

    for (const stage of [
      'mission_01', 'mission_02', 'mission_03', 'mission_04',
      'mission_05', 'mission_06', 'final_30',
    ]) {
      expect(story).toContain(`when '${stage}'`);
    }
    expect(story).toContain('довести поезд Виктора до BK-17'.toLowerCase());
    expect(story).toContain('неизвестный источник');
    expect(story).not.toContain('лиза');
    expect(story).not.toMatch(/deadline|answeroptions|routes|problems|quota|score/);
  });

  it('keeps future archive inserts on the same anonymous route copy', () => {
    expect(normalized).toContain("when 'unknown-bk17' then jsonb_build_object");
    expect(normalized).toContain("'title', 'неизвестный оператор'");
    expect(normalized).toContain('before insert or update of artifact_key, content');
  });

  it('provides a private idempotent backfill for existing mission and archive rows', () => {
    const applyStart = normalized.indexOf(
      'create or replace function public._apply_bunker_route_story',
    );
    const applyEnd = normalized.indexOf(
      'revoke all on function public._apply_bunker_route_story',
      applyStart,
    );
    const apply = normalized.slice(applyStart, applyEnd);

    expect(applyStart).toBeGreaterThan(-1);
    expect(apply).toContain("security definer set search_path = ''");
    expect(apply).toContain('update public.bunker_mission_instances');
    expect(apply).toContain('update public.bunker_archive_entries');
    expect(normalized).toContain('select public._apply_bunker_route_story()');
    expect(normalized).toContain(
      'revoke all on function public._apply_bunker_route_story() from public, anon, authenticated',
    );
  });
});
