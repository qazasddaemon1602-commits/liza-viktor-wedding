import { describe, expect, it } from 'vitest';
import { getProjectorSoundtrackState, type ProjectorSoundtrackRpcClient } from './projectorSoundtrack.service';

function client(data: unknown): ProjectorSoundtrackRpcClient {
  return {
    rpc: async () => ({ data, error: null }),
  };
}

describe('getProjectorSoundtrackState', () => {
  it('parses the public server stage used by the projector soundtrack', async () => {
    await expect(getProjectorSoundtrackState(client({
      status: 'ok',
      currentModule: 'bunker',
      screenMode: 'bunker_mission',
      screenPinned: true,
      globalGameState: 'MISSION_03',
      soundEnabled: true,
      updatedAt: '2026-08-24T00:00:00.000Z',
    }), 'liza-viktor')).resolves.toMatchObject({
      currentModule: 'bunker',
      globalGameState: 'MISSION_03',
      soundEnabled: true,
    });
  });

  it('returns null for an unknown event and rejects malformed payloads', async () => {
    await expect(getProjectorSoundtrackState(client({ status: 'not_found' }), 'missing')).resolves.toBeNull();
    await expect(getProjectorSoundtrackState(client({ status: 'ok', currentModule: 123 }), 'liza-viktor'))
      .rejects.toThrow('Unexpected projector soundtrack state response');
  });
});
