import { describe, expect, it, vi } from 'vitest';
import { getMkTournamentScreenState, getMkTournamentState, joinMkTournament, type MkRpcClient } from './mk.service';

function clientWith(data: unknown): MkRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

describe('Mortal Kombat service', () => {
  it('loads only the safe public tournament projection for the current device', async () => {
    const client = clientWith({
      status: 'active',
      tournamentId: 't1',
      state: 'registration',
      activeCount: 9,
      maxPlayers: 16,
      ownRegistrationStatus: 'active',
      waitlistPosition: null,
      players: [{ registrationId: 'r1', guestId: 'g1', displayName: 'Иван Петров', seed: null }],
      matches: [],
      championGuestId: null,
      presentOnMainScreen: false,
    });

    const state = await getMkTournamentState(client, 'liza-viktor', 'device-123456');

    expect(client.rpc).toHaveBeenCalledWith('get_mk_tournament_state', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-123456',
    });
    expect(state).toMatchObject({
      status: 'active',
      state: 'registration',
      activeCount: 9,
      presentOnMainScreen: false,
    });
  });

  it('loads the same safe projection for a projector without a guest identity', async () => {
    const client = clientWith({ status: 'idle' });

    await getMkTournamentScreenState(client, 'liza-viktor');

    expect(client.rpc).toHaveBeenCalledWith('get_mk_tournament_state', {
      p_event_slug: 'liza-viktor',
      p_device_key: null,
    });
  });

  it('rejects active tournament payloads that omit the main-screen presentation flag', async () => {
    const client = clientWith({
      status: 'active',
      tournamentId: 't1',
      state: 'active',
      activeCount: 16,
      maxPlayers: 16,
      ownRegistrationStatus: null,
      waitlistPosition: null,
      players: [],
      matches: [],
      championGuestId: null,
    });

    await expect(getMkTournamentScreenState(client, 'liza-viktor'))
      .rejects.toThrow('Unexpected MK tournament payload');
  });

  it('joins with event/device identity instead of accepting a caller-supplied guest id', async () => {
    const client = clientWith({
      status: 'joined',
      registrationStatus: 'waitlist',
      activeCount: 16,
      maxPlayers: 16,
      waitlistPosition: 1,
    });

    const result = await joinMkTournament(client, 'liza-viktor', 'device-123456');

    expect(client.rpc).toHaveBeenCalledWith('join_mk_tournament', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-123456',
    });
    expect(result).toMatchObject({ registrationStatus: 'waitlist', waitlistPosition: 1 });
  });
});
