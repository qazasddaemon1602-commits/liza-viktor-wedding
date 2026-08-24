import { describe, expect, it, vi } from 'vitest';
import {
  subscribeToScreenEvents,
  type ScreenEventsRealtimeClient,
} from './screenEvents.realtime';

function guestRow(id = 'screen-event-31') {
  return {
    id,
    kind: 'guest_registered',
    created_at: '2026-08-30T12:06:00+05:00',
    payload: {
      displayName: 'Анна Смирнова',
      carriage: {
        id: 'c4',
        number: 4,
        label: 'ВАГОН №4',
        accentHex: '#78806A',
        visualMark: '04',
      },
    },
  };
}

describe('subscribeToScreenEvents', () => {
  it('subscribes only to public screen events for the current event slug and parses guest arrivals', () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();
    const subscribe = vi.fn();
    const on = vi.fn().mockReturnThis();
    const channel = { on, subscribe, unsubscribe };
    const client: ScreenEventsRealtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
    };

    const cleanup = subscribeToScreenEvents(client, 'liza-viktor', callback);

    expect(client.channel).toHaveBeenCalledWith('screen-events:liza-viktor');
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'screen_events',
        filter: 'event_slug=eq.liza-viktor',
      },
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();

    const handler = on.mock.calls[0][2];
    handler({ new: guestRow() });

    expect(callback).toHaveBeenCalledWith({
      id: 'screen-event-31',
      kind: 'guest_registered',
      createdAt: '2026-08-30T12:06:00+05:00',
      payload: {
        displayName: 'Анна Смирнова',
        carriage: {
          id: 'c4',
          number: 4,
          label: 'ВАГОН №4',
          accentHex: '#78806A',
          visualMark: '04',
        },
      },
    });

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('catches up a short-lived persisted event when realtime insert was missed', async () => {
    const callback = vi.fn();
    const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() };
    const order = vi.fn().mockResolvedValue({ data: [guestRow('catch-up-1')], error: null });
    const query = {
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order,
    };
    const select = vi.fn().mockReturnValue(query);
    const client: ScreenEventsRealtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
      from: vi.fn().mockReturnValue({ select }),
    };

    const cleanup = subscribeToScreenEvents(client, 'liza-viktor', callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

    expect(client.from).toHaveBeenCalledWith('screen_events');
    expect(query.eq).toHaveBeenCalledWith('event_slug', 'liza-viktor');
    expect(query.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });

    // The same event arriving after catch-up must not be presented twice.
    channel.on.mock.calls[0][2]({ new: guestRow('catch-up-1') });
    expect(callback).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('retries catch-up immediately when the realtime channel reports a degraded subscription', async () => {
    const callback = vi.fn();
    const subscribe = vi.fn();
    const channel = { on: vi.fn().mockReturnThis(), subscribe, unsubscribe: vi.fn() };
    const order = vi.fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce({ data: [guestRow('recovered-1')], error: null });
    const query = {
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order,
    };
    const client: ScreenEventsRealtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(query) }),
    };

    const cleanup = subscribeToScreenEvents(client, 'liza-viktor', callback);
    await vi.waitFor(() => expect(order).toHaveBeenCalledTimes(1));

    const onStatus = subscribe.mock.calls[0]?.[0] as ((status: string) => void) | undefined;
    expect(onStatus).toEqual(expect.any(Function));
    onStatus?.('TIMED_OUT');

    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'recovered-1' })));
    cleanup();
  });

  it('parses owner-published carriage call screen events', () => {
    const callback = vi.fn();
    const on = vi.fn().mockReturnThis();
    const channel = { on, subscribe: vi.fn(), unsubscribe: vi.fn() };
    const client: ScreenEventsRealtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
    };

    subscribeToScreenEvents(client, 'liza-viktor', callback);
    const handler = on.mock.calls[0][2];

    handler({
      new: {
        id: 'screen-call-1',
        kind: 'carriage_call',
        created_at: '2026-08-30T13:10:00+05:00',
        payload: {
          callId: 'call-1',
          message: 'ВАГОНЫ 2 И 4 — ГОТОВИМСЯ К СЛЕДУЮЩЕМУ КОНКУРСУ',
          carriages: [
            { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02' },
            { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
          ],
        },
      },
    });

    expect(callback).toHaveBeenCalledWith({
      id: 'screen-call-1',
      kind: 'carriage_call',
      createdAt: '2026-08-30T13:10:00+05:00',
      payload: {
        callId: 'call-1',
        message: 'ВАГОНЫ 2 И 4 — ГОТОВИМСЯ К СЛЕДУЮЩЕМУ КОНКУРСУ',
        carriages: [
          { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02' },
          { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
        ],
      },
    });
  });

  it('parses an owner-published carriage map only after validating the complete payload', () => {
    const callback = vi.fn();
    const on = vi.fn().mockReturnThis();
    const channel = { on, subscribe: vi.fn(), unsubscribe: vi.fn() };
    const client: ScreenEventsRealtimeClient = { channel: vi.fn().mockReturnValue(channel) };

    subscribeToScreenEvents(client, 'liza-viktor', callback);
    const handler = on.mock.calls[0][2];
    const map = {
      status: 'registration', expectedGuestCount: 2, registeredGuestCount: 1,
      serverNow: '2026-08-30T10:00:00.000Z', unassignedCount: 0,
      carriages: [
        { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#31483A', visualMark: '01', guests: [
          { id: 'g1', fullName: 'Анна Петрова', initials: 'АП', seatIndex: 1 },
        ] },
        { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02', guests: [] },
      ],
    };

    handler({ new: { id: 'map-1', kind: 'carriage_map_show', created_at: '2026-08-30T10:00:01.000Z', payload: { map } } });
    handler({ new: { id: 'map-2', kind: 'carriage_map_show', created_at: '2026-08-30T10:00:02.000Z', payload: { map: { ...map, carriages: [] } } } });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      id: 'map-1', kind: 'carriage_map_show', createdAt: '2026-08-30T10:00:01.000Z', payload: { map },
    });
  });

  it('ignores malformed or unsupported screen events', () => {
    const callback = vi.fn();
    const on = vi.fn().mockReturnThis();
    const channel = { on, subscribe: vi.fn(), unsubscribe: vi.fn() };
    const client: ScreenEventsRealtimeClient = {
      channel: vi.fn().mockReturnValue(channel),
    };

    subscribeToScreenEvents(client, 'liza-viktor', callback);
    const handler = on.mock.calls[0][2];

    handler({ new: { id: 'x', kind: 'unknown', payload: {} } });
    handler({ new: { id: 'x2', kind: 'guest_registered', payload: { displayName: '' } } });
    handler({ new: { id: 'x3', kind: 'carriage_call', payload: { message: 'Без вагонов', carriages: [] } } });

    expect(callback).not.toHaveBeenCalled();
  });
});

