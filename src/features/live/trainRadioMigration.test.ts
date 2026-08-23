// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const sql = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824022500_wedding_train_radio.sql`,
  'utf8',
).replace(/\s+/g, ' ');

describe('wedding train radio migration', () => {
  it('keeps radio owner-only and whitelist-driven', () => {
    expect(sql).toContain("v_owner uuid := auth.uid()");
    expect(sql).toContain("p_preset not in ('departure','toast','quiet_carriage','late_passenger','kiss','dance','quiz','arena','bunker','final')");
    expect(sql).toContain('grant execute on function public.owner_send_train_radio(text, text) to authenticated');
    expect(sql).not.toContain('grant execute on function public.owner_send_train_radio(text, text) to anon');
  });

  it('publishes a short-lived visual overlay without touching audio state', () => {
    expect(sql).toContain("'radio_transmission'");
    expect(sql).toContain("'durationMs', 12000");
    expect(sql).toContain("now() + interval '14 seconds'");
    expect(sql).not.toContain('sound_enabled');
    expect(sql).not.toContain('screenAudio');
  });
});
