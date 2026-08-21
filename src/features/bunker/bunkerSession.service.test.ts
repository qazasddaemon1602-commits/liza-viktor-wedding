import { describe, expect, it, vi } from 'vitest';
import {
  advanceBunkerGameState,
  distributeBunkerCharacters,
  parseBunkerContractState,
  prepareBunkerGame,
} from './bunkerSession.service';
import type { BunkerRpcClient } from './bunker.service';

function clientWith(data: unknown): BunkerRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

describe('Bunker session service', () => {
  it('branches on contractVersion before parsing legacy or strict V2 state', () => {
    expect(parseBunkerContractState({ contractVersion: 1, state: 'STORY_BUNKER' }))
      .toEqual({ contractVersion: 1, state: 'STORY_BUNKER' });
    expect(parseBunkerContractState({ contractVersion: 2, state: 'UNKNOWN_PASSENGER' }))
      .toEqual({ contractVersion: 2, state: 'UNKNOWN_PASSENGER' });
    expect(() => parseBunkerContractState({ contractVersion: 2, state: 'STORY_BUNKER' }))
      .toThrow(/state/i);
    expect(() => parseBunkerContractState({ contractVersion: 3, state: 'LOBBY' }))
      .toThrow(/version/i);
  });

  it('prepares one server-side game run without activating the final takeover', async () => {
    const client = clientWith({
      status: 'prepared',
      eventId: 'event-1',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'LOBBY',
      gameMode: 'production',
      wagonCount: 4,
      guestCount: 32,
    });

    await expect(prepareBunkerGame(client, 'event-1', 'production')).resolves.toMatchObject({
      status: 'prepared',
      globalGameState: 'LOBBY',
      wagonCount: 4,
      guestCount: 32,
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_prepare_bunker_game', {
      p_event_id: 'event-1',
      p_game_mode: 'production',
    });
  });

  it('reports an already prepared run without rolling characters back to the lobby', async () => {
    const client = clientWith({
      status: 'prepared',
      eventId: 'event-1',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY',
      gameMode: 'production',
      wagonCount: 4,
      guestCount: 32,
    });

    await expect(prepareBunkerGame(client, 'event-1', 'production')).resolves.toMatchObject({
      globalGameState: 'CHARACTERS_READY',
    });
  });

  it('distributes stable characters for the current run', async () => {
    const client = clientWith({
      status: 'characters_ready',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY',
      assignedCount: 32,
      wagonCount: 4,
    });

    await expect(distributeBunkerCharacters(client, 'event-1')).resolves.toMatchObject({
      status: 'characters_ready',
      assignedCount: 32,
      wagonCount: 4,
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_distribute_bunker_characters', {
      p_event_id: 'event-1',
    });
  });

  it('advances the global state through the owner RPC and returns its current mission', async () => {
    const client = clientWith({
      status: 'transitioned',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      previousState: 'CHARACTERS_READY',
      globalGameState: 'MISSION_01',
      changed: true,
      currentMission: {
        id: 'mission_01',
        state: 'MISSION_01',
        plan: [{ wagonId: 'wagon-1', exclusionCount: 2 }],
      },
    });

    await expect(advanceBunkerGameState(
      client,
      'event-1',
      'MISSION_01',
    )).resolves.toMatchObject({
      previousState: 'CHARACTERS_READY',
      globalGameState: 'MISSION_01',
      changed: true,
      currentMission: { id: 'mission_01', state: 'MISSION_01' },
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_advance_bunker_game_state', {
      p_event_id: 'event-1',
      p_next_state: 'MISSION_01',
    });
  });

  it('rejects a transition response whose mission disagrees with the new global state', async () => {
    await expect(advanceBunkerGameState(
      clientWith({
        status: 'transitioned',
        runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
        previousState: 'MISSION_01',
        globalGameState: 'BREAK',
        changed: true,
        currentMission: { id: 'mission_01', state: 'MISSION_01', plan: null },
      }),
      'event-1',
      'BREAK',
    )).rejects.toThrow(/transition/i);
  });

  it('rejects malformed privileged responses instead of guessing', async () => {
    await expect(prepareBunkerGame(
      clientWith({ status: 'prepared', runNonce: 'not-a-uuid' }),
      'event-1',
      'test',
    )).rejects.toThrow(/session/i);
    await expect(distributeBunkerCharacters(
      clientWith({ status: 'characters_ready', assignedCount: -1 }),
      'event-1',
    )).rejects.toThrow(/session/i);
  });
});
