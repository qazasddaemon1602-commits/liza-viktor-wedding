import { describe, expect, it, vi } from 'vitest';
import { submitBunkerCommand, type BunkerV2RpcClient } from './command.service';

describe('submitBunkerCommand', () => {
  it('calls only submit_bunker_command with the public identifiers and closed payload', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        contractVersion: 2,
        status: 'accepted',
        commandId: 'command-1',
        commandType: 'mission_confirm',
      },
      error: null,
    });
    const client: BunkerV2RpcClient = { rpc };

    await expect(submitBunkerCommand(
      client,
      'wedding',
      'device-key',
      'command-1',
      {
        type: 'mission_confirm',
        payload: { instanceId: 'instance-1', instanceVersion: 1, selection: ['guest-1'] },
      },
    )).resolves.toMatchObject({ status: 'accepted', commandType: 'mission_confirm' });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', {
      p_event_slug: 'wedding',
      p_device_key: 'device-key',
      p_command_id: 'command-1',
      p_command_type: 'mission_confirm',
      p_payload: { instanceId: 'instance-1', instanceVersion: 1, selection: ['guest-1'] },
    });
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args).not.toHaveProperty('p_guest_id');
    expect(args).not.toHaveProperty('p_carriage_id');
    expect(args).not.toHaveProperty('p_run_nonce');
  });

  it('rejects a malformed command before transport', async () => {
    const rpc = vi.fn();
    const client: BunkerV2RpcClient = { rpc };

    await expect(submitBunkerCommand(
      client,
      'wedding',
      'device-key',
      'command-1',
      {
        type: 'use_ability',
        payload: { instanceId: 'instance-1', problemKey: 'power', guestId: 'guest-1' },
      } as never,
    )).rejects.toThrow(/key/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserves RPC error codes and rejects malformed receipts', async () => {
    await expect(submitBunkerCommand(
      { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'conflict', code: '55000' } }) },
      'wedding', 'device-key', 'command-1',
      { type: 'cast_vote', payload: { instanceId: 'instance-6', vote: 'route-a' } },
    )).rejects.toMatchObject({ message: 'conflict', code: '55000' });

    await expect(submitBunkerCommand(
      { rpc: vi.fn().mockResolvedValue({ data: { status: 'ok' }, error: null }) },
      'wedding', 'device-key', 'command-1',
      { type: 'cast_vote', payload: { instanceId: 'instance-6', vote: 'route-a' } },
    )).rejects.toThrow(/receipt/i);
  });
});
