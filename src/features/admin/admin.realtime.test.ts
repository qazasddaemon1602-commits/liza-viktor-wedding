import { describe, expect, it, vi } from 'vitest';
import { subscribeToGuestRegistrations, type AdminRealtimeClient } from './admin.realtime';

describe('subscribeToGuestRegistrations', () => {
  it('subscribes to guest inserts for the current event and cleans up', () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const subscribe = vi.fn();
    const on = vi.fn().mockReturnThis();
    const channel = { on, subscribe, unsubscribe };
    const client: AdminRealtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
    };

    const cleanup = subscribeToGuestRegistrations(client, 'event-1', callback);

    expect(client.channel).toHaveBeenCalledWith('owner-guest-registration:event-1');
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'guests',
        filter: 'event_id=eq.event-1',
      },
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();

    const handler = on.mock.calls[0][2];
    handler({ new: { id: 'g31' } });
    expect(callback).toHaveBeenCalledWith('g31');

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
