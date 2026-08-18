import { describe, expect, it, vi } from 'vitest';
import {
  finalizeMkDraw,
  getOwnerMkControl,
  openMkRegistration,
  randomizeMkSeeds,
  swapMkSeeds,
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
});