import { describe, expect, it, vi } from 'vitest';
import {
  clearCarriageCall,
  getGuestActiveCarriageCalls,
  publishCarriageCallToScreen,
  sendCarriageCall,
  type CarriageCallRpcClient,
} from './carriageCalls.service';

function clientWith(data: unknown): CarriageCallRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('carriage calls service', () => {
  it('sends one owner call to one or multiple target carriages', async () => {
    const client = clientWith({
      status: 'sent',
      callId: 'call-1',
      message: 'Вагоны 2 и 4 — готовимся к следующему конкурсу',
      targetCarriageIds: ['c2', 'c4'],
      showOnScreen: true,
      createdAt: '2026-08-30T13:00:00+05:00',
    });

    const result = await sendCarriageCall(
      client,
      'event-1',
      ['c2', 'c4'],
      'Вагоны 2 и 4 — готовимся к следующему конкурсу',
      true,
    );

    expect(client.rpc).toHaveBeenCalledWith('owner_send_carriage_call', {
      p_event_id: 'event-1',
      p_carriage_ids: ['c2', 'c4'],
      p_message: 'Вагоны 2 и 4 — готовимся к следующему конкурсу',
      p_show_on_screen: true,
    });
    expect(result.callId).toBe('call-1');
    expect(result.targetCarriageIds).toEqual(['c2', 'c4']);
  });

  it('clears a call only through the owner RPC', async () => {
    const client = clientWith({ status: 'cleared', callId: 'call-1' });

    await clearCarriageCall(client, 'call-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_clear_carriage_call', {
      p_call_id: 'call-1',
    });
  });

  it('publishes a call to the projector only through the owner RPC', async () => {
    const client = clientWith({ status: 'published', screenEventId: 'screen-1' });

    const result = await publishCarriageCallToScreen(client, 'call-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_publish_carriage_call_screen_event', {
      p_call_id: 'call-1',
    });
    expect(result).toEqual({ status: 'published', screenEventId: 'screen-1' });
  });

  it('loads only active calls available to the current guest device', async () => {
    const client = clientWith({
      status: 'ok',
      carriage: {
        id: 'c4',
        number: 4,
        label: 'ВАГОН №4',
        accentHex: '#78806A',
        visualMark: '04',
      },
      calls: [
        {
          id: 'call-1',
          message: 'ВАГОН №4 — НА MORTAL KOMBAT',
          showOnScreen: false,
          createdAt: '2026-08-30T13:00:00+05:00',
        },
      ],
    });

    const result = await getGuestActiveCarriageCalls(
      client,
      'liza-viktor',
      'lvw_device_4',
    );

    expect(client.rpc).toHaveBeenCalledWith('get_guest_active_carriage_calls', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'lvw_device_4',
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.carriage.label).toBe('ВАГОН №4');
      expect(result.calls[0].message).toBe('ВАГОН №4 — НА MORTAL KOMBAT');
    }
  });

  it('returns not_found without exposing any other carriage calls', async () => {
    const client = clientWith({ status: 'not_found', calls: [] });

    expect(await getGuestActiveCarriageCalls(client, 'liza-viktor', 'unknown')).toEqual({
      status: 'not_found',
      calls: [],
    });
  });
});
