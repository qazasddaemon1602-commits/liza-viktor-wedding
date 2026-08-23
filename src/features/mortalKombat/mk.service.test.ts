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
  activeCount: 16,
  maxPlayers: 16,
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

  it('accepts the 16-player contract and opening R16 matches', async () => {
    const client = clientWith({
      ...hiddenActiveTournament,
      presentOnMainScreen: true,
      matches: [{
        id: 'm1', matchKey: 'r16-1', round: 'r16', position: 1,
        player1GuestId: 'g1', player2GuestId: 'g16', winnerGuestId: null,
        status: 'ready', current: true,
      }],
    });

    await expect(getMkTournamentDedicatedScreenState(client, 'liza-viktor'))
      .resolves.toMatchObject({ maxPlayers: 16, matches: [{ round: 'r16' }] });
  });

  it('normalizes the legacy production cap while no more than 16 players are active', async () => {
    const client = clientWith({
      ...hiddenActiveTournament,
      activeCount: 0,
      maxPlayers: 40,
    });

    await expect(getMkTournamentDedicatedScreenState(client, 'liza-viktor'))
      .resolves.toMatchObject({ activeCount: 0, maxPlayers: 16 });
  });

  it('does not hide an over-cap legacy tournament behind the 16-player contract', async () => {
    const client = clientWith({
      ...hiddenActiveTournament,
      activeCount: 17,
      maxPlayers: 40,
    });

    await expect(getMkTournamentDedicatedScreenState(client, 'liza-viktor'))
      .rejects.toThrow('Unexpected MK tournament payload');
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

    await expect(getMkTournamentDedicatedScreenState(client, 'liza-viktor'))
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

  it('normalizes a legacy join response to the 16-player client cap', async () => {
    const client = clientWith({
      status: 'joined',
      registrationStatus: 'active',
      activeCount: 1,
      maxPlayers: 40,
      waitlistPosition: null,
    });

    await expect(joinMkTournament(client, 'liza-viktor', 'device-123456'))
      .resolves.toMatchObject({ activeCount: 1, maxPlayers: 16 });
  });
});

