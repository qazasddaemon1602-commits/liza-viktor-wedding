// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260826010000_ilya_song_screen_control.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('Ilya song screen control migration', () => {
  it('keeps play and stop owner-only and cancels the preceding song event', () => {
    expect(sql).toContain('v_owner uuid := auth.uid()');
    expect(sql).toContain("p_action not in ('play', 'stop')");
    expect(sql).toContain("kind = 'ilya_song'");
    expect(sql).toContain('set expires_at = now()');
    expect(sql).toContain('grant execute on function public.owner_control_ilya_song(text, text) to authenticated');
    expect(sql).not.toContain('grant execute on function public.owner_control_ilya_song(text, text) to anon');
  });

  it('publishes the real song metadata for long enough to survive screen reconnects', () => {
    expect(sql).toContain("'ilya_song'");
    expect(sql).toContain("'title', 'Песня про Илью'");
    expect(sql).toContain("'artist', 'Посажёный отец'");
    expect(sql).toContain("'durationMs', 233080");
    expect(sql).toContain("now() + interval '4 minutes'");
  });
});
