// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823191000_bunker_v2_lifecycle_hardening.sql`,
  'utf8',
);
const normalized = migration.replace(/\s+/g, ' ').toLowerCase();

describe('Bunker V2 lifecycle hardening migration', () => {
  it('reactivates a V2 run when its authoritative global state advances', () => {
    expect(normalized).toContain('create or replace function public.guard_bunker_v2_lifecycle()');
    expect(normalized).toContain("new.status := 'active'");
    expect(normalized).toContain('new.started_at := coalesce(new.started_at, clock_timestamp())');
    expect(normalized).toContain('before update of global_game_state on public.bunker_state');
  });

  it('publishes every V2 bunker state to the projector event state', () => {
    expect(normalized).toContain('create or replace function public.sync_bunker_v2_state_to_screen()');
    expect(normalized).toContain("set current_module = 'bunker'");
    expect(normalized).toContain('screen_pinned = true');
    for (const mode of [
      'bunker_lobby',
      'bunker_characters_ready',
      'bunker_mission',
      'bunker_break',
      'bunker_unknown_passenger',
      'bunker_emergency',
      'bunker_open',
      'bunker_results',
    ]) {
      expect(normalized).toContain(`'${mode}'`);
    }
    expect(normalized).toContain('after update of global_game_state on public.bunker_state');
  });

  it('covers terminal success and emergency opening without depending on game-event names', () => {
    expect(normalized).toContain('new.global_game_state is not distinct from old.global_game_state');
    expect(normalized).toContain("when 'bunker_open' then 'бункер открыт'");
    expect(normalized).not.toContain("new.event_type = 'v2_global_state_transition'");
  });

  it('marks V2 BUNKER_OPEN as unlocked for projector and reveal routing', () => {
    expect(normalized).toContain("if new.global_game_state = 'bunker_open' then");
    expect(normalized).toContain('new.unlocked_at := coalesce(new.unlocked_at, clock_timestamp())');
    expect(normalized).toContain('new.bunker_revealed := true');
  });
});
