// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824020500_wedding_live_reactions.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('wedding live reactions migration', () => {
  it('enforces the five-second cooldown on the server', () => {
    expect(sql).toContain("interval '5 seconds'");
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("'status', 'cooldown'");
  });

  it('publishes a short-lived screen event rather than permanent projector state', () => {
    expect(sql).toContain("'guest_reaction'");
    expect(sql).toContain("v_now + interval '8 seconds'");
    expect(sql).toContain('insert into public.screen_events');
  });

  it('does not expose the cooldown state table directly to guests', () => {
    expect(sql).toContain('alter table public.wedding_live_reaction_state enable row level security');
    expect(sql).toContain('revoke all on table public.wedding_live_reaction_state from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.submit_guest_live_reaction(text, text, text) to anon, authenticated');
  });
});
