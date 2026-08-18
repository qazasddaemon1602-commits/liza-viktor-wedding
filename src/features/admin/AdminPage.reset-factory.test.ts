import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  rpc: vi.fn(),
  channel: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: mocked.rpc,
    channel: mocked.channel,
  }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies rehearsal reset wiring', () => {
  beforeEach(() => {
    mocked.rpc.mockReset();
    mocked.channel.mockReset();
  });

  it('wires the guarded owner reset and refreshes open projector modes', async () => {
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

    const channels = new Map<string, {
      send: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      unsubscribe: ReturnType<typeof vi.fn>;
    }>();
    mocked.channel.mockImplementation((name: string) => {
      const channel = {
        send: vi.fn().mockResolvedValue('ok'),
        on: vi.fn(),
        subscribe: vi.fn((callback?: (status: string) => void) => {
          callback?.('SUBSCRIBED');
          return channel;
        }),
        unsubscribe: vi.fn(),
      };
      channels.set(name, channel);
      return channel;
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
    expect(mocked.channel).toHaveBeenCalledWith('premiere:liza-viktor');
    expect(mocked.channel).toHaveBeenCalledWith('quiz:liza-viktor');
    expect(channels.get('premiere:liza-viktor')?.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
    expect(channels.get('quiz:liza-viktor')?.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
  });
});