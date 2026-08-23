// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824013000_final_five_intrigue_questions.sql`,
  'utf8',
);
const normalized = migration.replace(/\s+/g, ' ');

const expected = [
  'Кто из вас первым поймёт, что второй расстроен, даже если услышит: «Всё нормально»?',
  'Кому из вас сложнее первым признать: «Да, тут я был(а) неправ(а)»?',
  'Кто из вас скорее однажды скажет: «А давай всё бросим и куда-нибудь уедем»?',
  'Кто из вас лучше понимает, чего хочет второй, ещё до того, как тот сам это сформулировал?',
  'Кто из вас через десять лет всё ещё будет чаще устраивать другому неожиданные сюрпризы?',
] as const;

describe('final five intrigue questions migration', () => {
  it('updates all five live final-five questions in order', () => {
    expected.forEach((question) => expect(normalized).toContain(question));
    for (const order of [101, 102, 103, 104, 105]) {
      expect(normalized).toContain(`when ${order} then`);
      expect(normalized).toContain(`'final_five', ${order}, true`);
    }
  });

  it('redefines the seed so old duplicate questions cannot return', () => {
    expect(normalized).toContain('create or replace function public.owner_seed_final_five_questions');
    expect(normalized).not.toContain("'Кто главный?'");
    expect(normalized).not.toContain("'Кто транжира?'");
    expect(normalized).not.toContain("'Кто кого больше избаловал?'");
  });

  it('does not touch personal access links or saved final-five answers', () => {
    expect(normalized).not.toContain('delete from public.final_five_role_access');
    expect(normalized).not.toContain('update public.final_five_role_access');
    expect(normalized).not.toContain('delete from public.final_five_answers');
  });
});
