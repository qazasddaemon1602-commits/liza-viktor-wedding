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
      serverNow: '2026-08-30T18:00:08.000Z',
    });

    await expect(getBunkerScreenState(client, 'liza-viktor')).resolves.toMatchObject({
      status: 'active',
      remainingSeconds: 1792,
    });
    expect(client.rpc).toHaveBeenCalledWith('get_bunker_screen_state', { p_event_slug: 'liza-viktor' });
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
});
