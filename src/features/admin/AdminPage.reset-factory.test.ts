import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mocked.rpc }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies rehearsal reset wiring', () => {
  beforeEach(() => mocked.rpc.mockReset());

  it('wires the guarded owner test reset RPC', async () => {
    mocked.rpc.mockResolvedValueOnce({
      data: {
        status: 'reset',
        deletedGuests: 32,
        preservedCoupleAnswers: 30,
        premiereConfigured: true,
        registrationOpen: true,
        nextTicketSequence: 1,
      },
      error: null,
    });

    const deps = createAdminPageDependencies();

    await expect(deps.resetEventTestData!('event-1', 'СБРОСИТЬ')).resolves.toEqual({
      deletedGuests: 32,
      preservedCoupleAnswers: 30,
      premiereConfigured: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });
    expect(mocked.rpc).toHaveBeenCalledWith('owner_reset_event_test_data', {
      p_event_id: 'event-1',
      p_confirmation: 'СБРОСИТЬ',
    });
  });
});