import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ rpc: vi.fn(), channel: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mocked.rpc, channel: mocked.channel }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies MK wiring', () => {
  beforeEach(() => {
    mocked.rpc.mockReset();
    mocked.channel.mockReset();
  });

  it('wires owner MK RPCs and safe public refresh broadcasts', async () => {
    mocked.rpc
      .mockResolvedValueOnce({
        data: {
          status: 'owner', tournamentId: 't1', state: 'active', activeCount: 16,
          waitlistCount: 0, maxPlayers: 16, registrations: [], matches: [], championGuestId: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { status: 'recorded', matchId: 'm1', winnerGuestId: 'g1', affectedMatches: [] }, error: null })
      .mockResolvedValueOnce({ data: { status: 'bracket' }, error: null });

    const channel = {
      send: vi.fn().mockResolvedValue('ok'),
      on: vi.fn(),
      subscribe: vi.fn((callback?: (status: string) => void) => {
        callback?.('SUBSCRIBED');
        return channel;
      }),
      unsubscribe: vi.fn(),
    };
    mocked.channel.mockReturnValue(channel);

    const deps = createAdminPageDependencies();
    expect(deps.mortalKombat).toBeDefined();

    await expect(deps.mortalKombat!.load('event-1')).resolves.toMatchObject({ status: 'owner', state: 'active' });
    await expect(deps.mortalKombat!.recordWinner('m1', 'g1', false)).resolves.toMatchObject({ status: 'recorded' });
    await expect(deps.mortalKombat!.showBracket?.('event-1')).resolves.toBeUndefined();
    await deps.mortalKombat!.broadcastRefresh();

    expect(mocked.rpc).toHaveBeenNthCalledWith(1, 'owner_get_mk_control', { p_event_id: 'event-1' });
    expect(mocked.rpc).toHaveBeenNthCalledWith(2, 'owner_record_mk_winner', {
      p_match_id: 'm1',
      p_winner_guest_id: 'g1',
      clear_completed_downstream: false,
    });
    expect(mocked.rpc).toHaveBeenNthCalledWith(3, 'owner_show_mk_bracket', {
      p_event_id: 'event-1',
    });
    expect(mocked.channel).toHaveBeenCalledWith('mk:liza-viktor');
    expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'refresh', payload: {} });
  });
});
