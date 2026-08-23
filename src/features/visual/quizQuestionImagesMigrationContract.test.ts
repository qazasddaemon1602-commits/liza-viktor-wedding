// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const migrationPath = resolve(
  testRuntime.process.cwd(),
  'supabase/migrations/20260823040000_quiz_question_images.sql',
);

describe('quiz question image migration contract', () => {
  it('maps every canonical seeded standard question to its stable WebP path', () => {
    expect(existsSync(migrationPath), 'quiz image migration must exist').toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    const mappings = [...sql.matchAll(/\(\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'(\/images\/quiz\/q\d{2}\.webp)'\s*\)/g)]
      .map((match) => ({ sortOrder: Number(match[1]), text: match[2], imagePath: match[3] }));

    expect(mappings).toHaveLength(30);
    expect(mappings.map(({ sortOrder }) => sortOrder)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    );
    expect(mappings.map(({ imagePath }) => imagePath)).toEqual(
      Array.from({ length: 30 }, (_, index) => `/images/quiz/q${String(index + 1).padStart(2, '0')}.webp`),
    );
  });

  it('guards the update with standard type, stable sort order and exact seed text', () => {
    expect(existsSync(migrationPath), 'quiz image migration must exist').toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').replace(/\s+/g, ' ').toLowerCase();

    expect(sql).toContain("q.question_type = 'standard'");
    expect(sql).toContain('q.sort_order = seed.sort_order');
    expect(sql).toContain('q.text = seed.question_text');
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });

  it('pins the security-definer seed function to an empty search path', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const functionSql = sql.slice(sql.indexOf('create or replace function public.owner_seed_default_quiz_questions'));

    expect(functionSql).toMatch(/security definer\s+set search_path = ''/i);
    expect(functionSql).not.toMatch(/set search_path = public/i);
    expect(functionSql).toMatch(/from public\.events e/i);
    expect(functionSql).toMatch(/insert into public\.questions/i);
    expect(functionSql).toMatch(/insert into public\.quiz_state/i);
    expect(functionSql).toMatch(/insert into public\.owner_action_log/i);
  });
});
