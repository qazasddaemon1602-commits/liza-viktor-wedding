// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823044000_bunker_operator_feed_locking.sql`,
  'utf8',
);
const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

describe('Bunker operator feed locking migration', () => {
  const start = normalized.indexOf(
    'create or replace function public.get_bunker_operator_feed',
  );
  const end = normalized.indexOf(
    'revoke all on function public.get_bunker_operator_feed',
    start,
  );
  const feed = normalized.slice(start, end);

  it('keeps state and message reads unlocked until fallback persistence is necessary', () => {
    const lockAt = feed.indexOf('for update');
    const beforeLock = feed.slice(0, lockAt);

    expect(start).toBeGreaterThan(-1);
    expect(lockAt).toBeGreaterThan(-1);
    expect(feed.match(/for update/g)).toHaveLength(1);
    expect(beforeLock).toContain('from public.bunker_state');
    expect(beforeLock).toContain('from public.bunker_operator_messages');
    expect(beforeLock).toContain('if v_fallback_required then');
  });

  it('locks only the fallback branch and revalidates state, run, stage and message', () => {
    const afterLock = feed.slice(feed.indexOf('for update'));

    expect(afterLock).toContain('from public.bunker_game_runs');
    expect(afterLock).toContain('from public.bunker_mission_instances');
    expect(afterLock).toContain('from public.bunker_operator_messages');
    expect(afterLock).toContain('insert into public.bunker_operator_messages');
    expect(afterLock).toContain('on conflict (event_id, run_nonce, stage) do nothing');
  });

  it('preserves feed hardening and explicit API access', () => {
    expect(feed).toContain("security definer set search_path = ''");
    expect(normalized).toContain(
      'revoke all on function public.get_bunker_operator_feed(text) from public, anon, authenticated',
    );
    expect(normalized).toContain(
      'grant execute on function public.get_bunker_operator_feed(text) to anon, authenticated',
    );
  });
});
