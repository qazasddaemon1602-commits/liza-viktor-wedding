// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260824003000_projector_soundtrack_state.sql`,
  'utf8',
);
const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

describe('projector soundtrack state migration', () => {
  it('exposes only sanitized projector state to anonymous screens', () => {
    expect(normalized).toContain('create or replace function public.get_projector_soundtrack_state(p_event_slug text)');
    expect(normalized).toContain("security definer set search_path = ''");
    expect(normalized).toContain("'currentmodule'");
    expect(normalized).toContain("'screenmode'");
    expect(normalized).toContain("'globalgamestate'");
    expect(normalized).toContain('grant execute on function public.get_projector_soundtrack_state(text) to anon, authenticated');
  });

  it('follows the live quiz state when the legacy event-state row remains idle', () => {
    expect(normalized).toContain('left join public.quiz_state qs on qs.event_id = e.id');
    expect(normalized).toContain("coalesce(v_quiz_phase, 'idle') in ('voting', 'results')");
    expect(normalized).toContain("v_current_module := 'quiz'");
    expect(normalized).toContain("v_screen_mode := 'quiz_' || v_quiz_phase");
  });

  it('honors the Bunker sound switch without exposing private game data', () => {
    expect(normalized).toContain('left join public.bunker_state bs on bs.event_id = e.id');
    expect(normalized).toContain("when coalesce(v_current_module, 'idle') = 'bunker' then coalesce(v_bunker_sound_enabled, true)");
    expect(normalized).not.toContain('bunker_guest_profiles');
    expect(normalized).not.toContain('guest_device_bindings');
  });
});
