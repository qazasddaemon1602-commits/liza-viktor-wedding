import { describe, expect, it, vi } from 'vitest';
import {
  getGuestBunkerV2Runtime,
  getOwnerBunkerV2Runtime,
  type BunkerV2RuntimeRpcClient,
} from './runtime.service';

const idleRuntime = {
  contractVersion: 2,
  status: 'idle',
  serverNow: '2026-08-21T18:00:00.000Z',
};

describe('Bunker V2 runtime transport', () => {
  it('uses the guest V2 read RPC and parses V2 only', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: idleRuntime, error: null });
    const client: BunkerV2RuntimeRpcClient = { rpc };

    await expect(getGuestBunkerV2Runtime(client, 'wedding', 'device-key'))
      .resolves.toEqual(idleRuntime);
    expect(rpc).toHaveBeenCalledWith('get_guest_bunker_v2_runtime', {
      p_event_slug: 'wedding',
      p_device_key: 'device-key',
    });

    await expect(getGuestBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: { ...idleRuntime, contractVersion: 1 }, error: null }) },
      'wedding',
      'device-key',
    )).rejects.toThrow(/version/i);
  });

  it('uses the owner V2 read RPC without guest authority arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: idleRuntime, error: null });
    const client: BunkerV2RuntimeRpcClient = { rpc };

    await expect(getOwnerBunkerV2Runtime(client, 'event-1')).resolves.toEqual(idleRuntime);
    expect(rpc).toHaveBeenCalledWith('get_owner_bunker_v2_runtime', { p_event_id: 'event-1' });
  });

  it('preserves read RPC error codes', async () => {
    await expect(getOwnerBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'owner only', code: '42501' } }) },
      'event-1',
    )).rejects.toMatchObject({ message: 'owner only', code: '42501' });
  });
});
