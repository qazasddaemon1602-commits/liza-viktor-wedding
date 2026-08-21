import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  rpc: vi.fn(),
  channel: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: mocked.rpc,
    channel: mocked.channel,
    auth: {
      signOut: mocked.signOut,
      onAuthStateChange: mocked.onAuthStateChange,
    },
  }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies rehearsal reset wiring', () => {
  beforeEach(() => {
    mocked.rpc.mockReset();
    mocked.channel.mockReset();
    mocked.signOut.mockReset();
    mocked.onAuthStateChange.mockReset();
  });

  it('signs out only this admin device and forwards authenticated session changes', async () => {
    const unsubscribe = vi.fn();
    let authCallback: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
    mocked.signOut.mockResolvedValue({ error: null });
    mocked.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    const sessionListener = vi.fn();

    const deps = createAdminPageDependencies();
    const stop = deps.subscribeToAuthState!(sessionListener);
    authCallback?.('SIGNED_IN', { user: { id: 'owner-1' } });
    authCallback?.('SIGNED_OUT', null);
    await deps.signOut();
    stop();

    expect(sessionListener).toHaveBeenNthCalledWith(1, { userId: 'owner-1' });
    expect(sessionListener).toHaveBeenNthCalledWith(2, null);
    expect(mocked.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('wires the guarded owner reset and refreshes every protected projector mode', async () => {
    mocked.rpc.mockResolvedValueOnce({
      data: {
        status: 'reset',
        deletedGuests: 32,
        preservedCoupleAnswers: 30,
        premiereConfigured: true,
        mortalKombatReset: true,
        bunkerReset: true,
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
      mortalKombatReset: true,
      bunkerReset: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });
    expect(mocked.rpc).toHaveBeenCalledWith('owner_reset_event_test_data', {
      p_event_id: 'event-1',
      p_confirmation: 'СБРОСИТЬ',
    });

    for (const channelName of [
      'premiere:liza-viktor',
      'quiz:liza-viktor',
      'mk:liza-viktor',
      'bunker:liza-viktor',
    ]) {
      expect(mocked.channel).toHaveBeenCalledWith(channelName);
      expect(channels.get(channelName)?.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'refresh',
        payload: {},
      });
    }
  });

  it('keeps a completed reset successful when a best-effort projector refresh fails', async () => {
    mocked.rpc.mockResolvedValueOnce({
      data: {
        status: 'reset',
        deletedGuests: 3,
        preservedCoupleAnswers: 30,
        premiereConfigured: true,
        mortalKombatReset: true,
        bunkerReset: true,
        registrationOpen: true,
        nextTicketSequence: 1,
      },
      error: null,
    });
    mocked.channel.mockImplementation(() => {
      const channel = {
        send: vi.fn().mockRejectedValue(new Error('realtime unavailable')),
        on: vi.fn(),
        subscribe: vi.fn((callback?: (status: string) => void) => {
          callback?.('SUBSCRIBED');
          return channel;
        }),
        unsubscribe: vi.fn(),
      };
      return channel;
    });

    const deps = createAdminPageDependencies();

    await expect(deps.resetEventTestData!('event-1', 'СБРОСИТЬ')).resolves.toMatchObject({
      deletedGuests: 3,
      nextTicketSequence: 1,
    });
  });
});
