import { describe, expect, it, vi } from 'vitest';
import {
  getBunkerScreenState,
  getOwnerBunkerControl,
  startBunker,
  stopBunker,
  type BunkerRpcClient,
} from './bunker.service';

function clientWith(data: unknown): BunkerRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

describe('bunker service', () => {
  it('parses synchronized active projector state', async () => {
    const client = clientWith({
      status: 'active',
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 1792,
      soundEnabled: true,
      globalGameState: 'MISSION_04',
      currentMission: {
        id: 'mission_04', state: 'MISSION_04', plan: { route: 'east' },
      },
      serverNow: '2026-08-30T18:00:08.000Z',
    });

    await expect(getBunkerScreenState(client, 'liza-viktor')).resolves.toMatchObject({
      status: 'active',
      remainingSeconds: 1792,
      globalGameState: 'MISSION_04',
      currentMission: {
        id: 'mission_04', state: 'MISSION_04', plan: { route: 'east' },
      },
    });
    expect(client.rpc).toHaveBeenCalledWith('get_bunker_screen_state', { p_event_slug: 'liza-viktor' });
  });

  it('parses safe quest phase and carriage progress without secret fragments', async () => {
    const client = clientWith({
      status: 'active',
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 1200,
      soundEnabled: false,
      phase: 'mission_b',
      unlocked: false,
      characterCounts: { active: 17, saved: 2, excluded: 1 },
      globalGameState: 'MISSION_06',
      currentMission: {
        id: 'mission_06', state: 'MISSION_06', plan: { checkpoint: 'north' },
      },
      teams: [
        { carriageNumber: 1, label: 'ВАГОН №1', missionAComplete: true, missionBComplete: true },
        { carriageNumber: 2, label: 'ВАГОН №2', missionAComplete: true, missionBComplete: false },
      ],
      serverNow: '2026-08-30T18:10:00.000Z',
    });

    const state = await getBunkerScreenState(client, 'liza-viktor');
    expect(state).toMatchObject({
      status: 'active',
      phase: 'mission_b',
      unlocked: false,
      characterCounts: { active: 17, saved: 2, excluded: 1 },
      globalGameState: 'MISSION_06',
      currentMission: {
        id: 'mission_06', state: 'MISSION_06', plan: { checkpoint: 'north' },
      },
      teams: [
        { carriageNumber: 1, missionBComplete: true },
        { carriageNumber: 2, missionBComplete: false },
      ],
    });
    expect(JSON.stringify(state)).not.toContain('fragment');
  });

  it('wires owner start/stop commands with the 30 minute default', async () => {
    const client = clientWith({ status: 'active' });
    await startBunker(client, 'event-1');
    await stopBunker(client, 'event-1');

    expect(client.rpc).toHaveBeenNthCalledWith(1, 'owner_start_bunker', {
      p_event_id: 'event-1',
      p_duration_seconds: 1800,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'owner_stop_bunker', { p_event_id: 'event-1' });
  });

  it('loads owner state without exposing anything beyond timer/sound metadata', async () => {
    const client = clientWith({
      status: 'idle',
      durationSeconds: 1800,
      soundEnabled: true,
      serverNow: '2026-08-30T18:00:00.000Z',
    });

    await expect(getOwnerBunkerControl(client, 'event-1')).resolves.toEqual({
      status: 'idle',
      durationSeconds: 1800,
      soundEnabled: true,
      serverNow: '2026-08-30T18:00:00.000Z',
    });
  });

  it('restores the authoritative owner global state and matching mission', async () => {
    const client = clientWith({
      status: 'active',
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 900,
      soundEnabled: true,
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'MISSION_03',
      currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
      serverNow: '2026-08-30T18:15:00.000Z',
    });

    await expect(getOwnerBunkerControl(client, 'event-1')).resolves.toMatchObject({
      status: 'active',
      globalGameState: 'MISSION_03',
      currentMission: { id: 'mission_03', state: 'MISSION_03' },
    });
  });
});

