import { describe, expect, it, vi } from 'vitest';
import { createReassignGuestDependency } from './AdminPage';

describe('createReassignGuestDependency', () => {
  it('broadcasts both old and new carriage channels only after the RPC succeeds', async () => {
    const order: string[] = [];
    const rpc = vi.fn(async () => { order.push('rpc'); });
    const broadcast = vi.fn(async () => { order.push('broadcast'); });
    const reassign = createReassignGuestDependency(rpc, broadcast);

    await reassign({ guestId: 'g31', fromCarriageId: 'c3', toCarriageId: 'c4' });

    expect(rpc).toHaveBeenCalledWith('g31', 'c4');
    expect(broadcast).toHaveBeenCalledWith(['c3', 'c4']);
    expect(order).toEqual(['rpc', 'broadcast']);
  });

  it('keeps a successful reassignment successful when best-effort broadcasting fails', async () => {
    const rpc = vi.fn().mockResolvedValue(undefined);
    const reassign = createReassignGuestDependency(
      rpc,
      vi.fn().mockRejectedValue(new Error('realtime offline')),
    );

    await expect(reassign({ guestId: 'g31', fromCarriageId: 'c3', toCarriageId: 'c4' })).resolves.toBeUndefined();
  });

  it('does not broadcast when the authoritative RPC rejects', async () => {
    const broadcast = vi.fn();
    const reassign = createReassignGuestDependency(
      vi.fn().mockRejectedValue(new Error('rpc rejected')),
      broadcast,
    );

    await expect(reassign({ guestId: 'g31', fromCarriageId: 'c3', toCarriageId: 'c4' })).rejects.toThrow('rpc rejected');
    expect(broadcast).not.toHaveBeenCalled();
  });
});
