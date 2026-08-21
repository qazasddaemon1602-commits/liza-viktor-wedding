import { describe, expect, it, vi } from 'vitest';
import {
  getMkTournamentDedicatedScreenState,
  getMkTournamentScreenState,
  getMkTournamentState,
  joinMkTournament,
  type MkRpcClient,
} from './mk.service';

function clientWith(data: unknown): MkRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

const hiddenActiveTournament = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
  activeCount: 40,
  maxPlayers: 40,
  ownRegistrationStatus: null,
  waitlistPosition: null,
  players: [{ registrationId: 'r1', guestId: 'g1', displayName: 'Иван Петров', seed: 1 }],
  matches: [],
  championGuestId: null,
  presentOnMainScreen: false,
};

describe('Mortal Kombat service', () => {
  it('loads only the safe public tournament projection for the current device', async () => {
    const client = clientWith({
      ...hiddenActiveTournament,
      state: 'registration',
      activeCount: 9,
      ownRegistrationStatus: 'active',
      players: [{ registrationId: 'r1', guestId: 'g1', displayName: 'Иван Петров', seed: null }],
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

  it('hides an active tournament from the main projector when owner presentation is off', async () => {
    const client = clientWith(hiddenActiveTournament);

    const result = await getMkTournamentScreenState(client, 'liza-viktor');

    expect(client.rpc).toHaveBeenCalledWith('get_mk_tournament_state', {
      p_event_slug: 'liza-viktor',
      p_device_key: null,
    });
    expect(result).toEqual({ status: 'idle' });
  });

  it('keeps the dedicated MK projector on the tournament even when main-screen presentation is off', async () => {
    const client = clientWith(hiddenActiveTournament);

    const result = await getMkTournamentDedicatedScreenState(client, 'liza-viktor');

    expect(result).toMatchObject({ status: 'active', state: 'active', presentOnMainScreen: false });
  });

  it('accepts the 40-player contract and opening r64 matches', async () => {
    const client = clientWith({
      ...hiddenActiveTournament,
      presentOnMainScreen: true,
      matches: [{
        id: 'm1', matchKey: 'r64-1', round: 'r64', position: 1,
        player1GuestId: 'g1', player2GuestId: 'g40', winnerGuestId: null,
        status: 'ready', current: true,
      }],
    });

    await expect(getMkTournamentDedicatedScreenState(client, 'liza-viktor'))
      .resolves.toMatchObject({ maxPlayers: 40, matches: [{ round: 'r64' }] });
  });

  it('rejects active tournament payloads that omit the main-screen presentation flag', async () => {
    const client = clientWith({
      status: 'active',
      tournamentId: 't1',
      state: 'active',
      activeCount: 40,
      maxPlayers: 40,
      ownRegistrationStatus: null,
      waitlistPosition: null,
      players: [],
      matches: [],
      championGuestId: null,
    });

    await expect(getMkTournamentDedicatedScreenState(client, 'liza-viktor'))
      .rejects.toThrow('Unexpected MK tournament payload');
  });

  it('joins with event/device identity instead of accepting a caller-supplied guest id', async () => {
    const client = clientWith({
      status: 'joined',
      registrationStatus: 'waitlist',
      activeCount: 40,
      maxPlayers: 40,
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

