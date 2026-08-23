// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823194500_remove_legacy_bunker_event_screen_bridge.sql`,
  'utf8',
).replace(/\s+/g, ' ').toLowerCase();

describe('single authoritative Bunker V2 projector bridge', () => {
  it('removes the older game-event bridge that can overwrite bunker_state routing', () => {
    expect(migration).toContain('drop trigger if exists bunker_v2_screen_bridge_trigger on public.bunker_game_events');
    expect(migration).toContain('drop function if exists public.sync_bunker_v2_screen_state()');
  });

  it('keeps the bunker_state projector bridge as the authority', () => {
    expect(migration).toContain('bunker_v2_state_screen_sync_trigger');
    expect(migration).toContain('sync_bunker_v2_state_to_screen');
  });
});
