import { describe, expect, it, vi } from 'vitest';
import {
  finalizeMkDraw,
  getOwnerMkControl,
  openMkRegistration,
  randomizeMkSeeds,
  recordMkWinner,
  setCurrentMkMatch,
  showMkBracket,
  swapMkSeeds,
  undoMkResult,
  type MkOwnerRpcClient,
} from './mk.owner.service';

function clientWith(data: unknown): MkOwnerRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

const ownerPayload = {
  status: 'owner',
  tournamentId: 't1',
  state: 'draw_ready',
  activeCount: 16,
  waitlistCount: 2,
  maxPlayers: 16,
  registrations: Array.from({ length: 16 }, (_, index) => ({
    registrationId: `r${index + 1}`,
    guestId: `g${index + 1}`,
    displayName: `Игрок ${index + 1}`,
    status: 'active',
    seed: index + 1,
    registeredAt: '2026-08-30T12:00:00.000Z',
  })),
  matches: [],
  championGuestId: null,
};

describe('owner MK service', () => {
  it('loads the private owner control projection', async () => {
    const client = clientWith(ownerPayload);
    const state = await getOwnerMkControl(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_get_mk_control', { p_event_id: 'event-1' });
    expect(state).toMatchObject({ status: 'owner', activeCount: 16, waitlistCount: 2 });
  });

  it('uses protected RPCs for open, randomize, swap and final draw', async () => {
    const client = clientWith({ status: 'ok' });

    await openMkRegistration(client, 'event-1');
    await randomizeMkSeeds(client, 'event-1');
    await swapMkSeeds(client, 'r1', 'r2');
    await finalizeMkDraw(client, 'event-1');

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'owner_open_mk_registration', { p_event_id: 'event-1' });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'owner_randomize_mk_seeds', { p_event_id: 'event-1' });
    expect(client.rpc).toHaveBeenNthCalledWith(3, 'owner_swap_mk_seeds', {
      p_registration_a: 'r1',
      p_registration_b: 'r2',
    });
    expect(client.rpc).toHaveBeenNthCalledWith(4, 'owner_finalize_mk_draw', { p_event_id: 'event-1' });
  });

  it('returns correction impact before destructive downstream clearing', async () => {
    const client = clientWith({
      status: 'impact',
      matchId: 'm-r16-1',
      affectedMatches: [
        { matchId: 'm-qf-1', matchKey: 'qf-1', round: 'qf', position: 1 },
      ],
    });

    const result = await recordMkWinner(client, 'm-r16-1', 'g1', false);

    expect(client.rpc).toHaveBeenCalledWith('owner_record_mk_winner', {
      p_match_id: 'm-r16-1',
      p_winner_guest_id: 'g1',
      clear_completed_downstream: false,
    });
    expect(result).toMatchObject({ status: 'impact' });
    if (result.status === 'impact') {
      expect(result.affectedMatches[0].matchKey).toBe('qf-1');
    }
  });

  it('wires fight/bracket projector selection and explicit undo confirmation flag', async () => {
    const client = clientWith({ status: 'undone', matchId: 'm1', affectedMatches: [] });

    await setCurrentMkMatch(client, 'm1');
    await showMkBracket(client, 'event-1');
    await undoMkResult(client, 'm1', true);

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'owner_set_current_mk_match', { p_match_id: 'm1' });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'owner_show_mk_bracket', { p_event_id: 'event-1' });
    expect(client.rpc).toHaveBeenNthCalledWith(3, 'owner_undo_mk_result', {
      p_match_id: 'm1',
      clear_completed_downstream: true,
    });
  });
});
