import { describe, expect, it, vi } from 'vitest';
import { publishRegistrationCarriageMap } from './carriageMapOwner.service';

describe('publishRegistrationCarriageMap', () => {
  it('publishes the projector command through the authenticated owner RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { status: 'published', screenEventId: 'event-1' },
      error: null,
    });

    await publishRegistrationCarriageMap({ rpc }, 'event-1');

    expect(rpc).toHaveBeenCalledWith('owner_publish_registration_carriage_map', {
      p_event_id: 'event-1',
    });
  });

  it('surfaces an RPC failure so the admin button can recover', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } });

    await expect(publishRegistrationCarriageMap({ rpc }, 'event-1')).rejects.toThrow('forbidden');
  });
});
