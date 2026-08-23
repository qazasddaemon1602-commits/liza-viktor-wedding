// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824021500_wedding_message_capsule.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('wedding message capsule migration', () => {
  it('stores one editable message per guest with a 280 character limit', () => {
    expect(sql).toContain('primary key (event_id, guest_id)');
    expect(sql).toContain('char_length(btrim(message)) between 1 and 280');
    expect(sql).toContain('on conflict (event_id, guest_id) do update');
    expect(sql).toContain("'maxLength', 280");
  });

  it('keeps message tables private and exposes only guarded RPCs', () => {
    expect(sql).toContain('alter table public.wedding_message_capsule enable row level security');
    expect(sql).toContain('revoke all on table public.wedding_message_capsule from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.save_guest_message_capsule(text, text, text) to anon, authenticated');
    expect(sql).toContain('grant execute on function public.owner_get_message_capsule(text) to authenticated');
  });

  it('publishes at most seven named messages as a short-lived projector event', () => {
    expect(sql).toContain("v_limit integer := least(greatest(coalesce(p_limit, 7), 1), 7)");
    expect(sql).toContain("'capsule_showcase'");
    expect(sql).toContain("now() + interval '60 seconds'");
    expect(sql).toContain("'displayName'");
    expect(sql).toContain("'carriage'");
  });
});
