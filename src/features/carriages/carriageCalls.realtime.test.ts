import { describe, expect, it, vi } from 'vitest';
import {
  broadcastCarriageCallRefresh,
  subscribeToCarriageCallRefresh,
  type CarriageCallRealtimeClient,
} from './carriageCalls.realtime';

function realtimeClient() {
  const send = vi.fn().mockResolvedValue('ok');
  const subscribe = vi.fn((callback?: (status: string) => void) => {
    callback?.('SUBSCRIBED');
    return channel;
  });
  const unsubscribe = vi.fn();
  const on = vi.fn().mockReturnThis();
  const channel = { send, subscribe, unsubscribe, on };
  const client: CarriageCallRealtimeClient = {
    channel: vi.fn().mockReturnValue(channel),
  };
  return { client, channel, send, subscribe, unsubscribe, on };
}

describe('carriage call realtime refresh signals', () => {
  it('broadcasts only an opaque refresh signal to each target carriage channel', async () => {
    const { client, send } = realtimeClient();

    await broadcastCarriageCallRefresh(client, ['c2', 'c4']);

    expect(client.channel).toHaveBeenCalledWith('carriage-call:c2');
    expect(client.channel).toHaveBeenCalledWith('carriage-call:c4');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
  });

  it('subscribes a guest only to their carriage channel and cleans up', () => {
    const { client, on, unsubscribe } = realtimeClient();
    const onRefresh = vi.fn();

    const cleanup = subscribeToCarriageCallRefresh(client, 'c4', onRefresh);

    expect(client.channel).toHaveBeenCalledWith('carriage-call:c4');
    expect(on).toHaveBeenCalledWith('broadcast', { event: 'refresh' }, expect.any(Function));
    const handler = on.mock.calls[0][2];
    handler({});
    expect(onRefresh).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
