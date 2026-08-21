import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mocked.rpc }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies adaptive carriage wiring', () => {
  beforeEach(() => mocked.rpc.mockReset());

  it('exposes the atomic distribution RPC to the existing admin shell', async () => {
    mocked.rpc.mockResolvedValueOnce({
      data: {
        status: 'locked',
        activeCarriageCount: 3,
        registeredGuestCount: 20,
        carriageSizes: [7, 7, 6],
        registrationOpen: true,
      },
      error: null,
    });

    const deps = createAdminPageDependencies();
    await expect(deps.applyCarriageDistribution?.('event-1', 3)).resolves.toMatchObject({
      activeCarriageCount: 3,
      carriageSizes: [7, 7, 6],
      registrationOpen: true,
    });
    expect(mocked.rpc).toHaveBeenCalledWith('owner_apply_carriage_distribution', {
      p_event_id: 'event-1',
      p_carriage_count: 3,
    });
  });
});
