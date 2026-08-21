import { describe, expect, it, vi } from 'vitest';
import {
  broadcastPremiereRefresh,
  subscribeToPremiereRefresh,
  type PremiereRealtimeChannel,
  type PremiereRealtimeClient,
} from './premiere.realtime';

function fakeClient() {
  let handler: (() => void) | undefined;
  const channel: PremiereRealtimeChannel = {
    on: vi.fn((_type, _filter, callback) => {
      handler = () => callback({});
      return channel;
    }),
    subscribe: vi.fn((callback) => {
      callback?.('SUBSCRIBED');
      return channel;
    }),
    send: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn(),
  };
  const client: PremiereRealtimeClient = { channel: vi.fn(() => channel) };
  return { client, channel, trigger: () => handler?.() };
}

describe('premiere realtime', () => {
  it('subscribes to an event-scoped refresh channel without payload data', () => {
    const { client, channel, trigger } = fakeClient();
    const refresh = vi.fn();

    const unsubscribe = subscribeToPremiereRefresh(client, 'liza-viktor', refresh);
    trigger();

    expect(client.channel).toHaveBeenCalledWith('premiere:liza-viktor');
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(channel.unsubscribe).toHaveBeenCalled();
  });

  it('broadcasts only an empty refresh signal', async () => {
    const { client, channel } = fakeClient();

    await broadcastPremiereRefresh(client, 'liza-viktor');

    expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'refresh', payload: {} });
    expect(channel.unsubscribe).toHaveBeenCalled();
  });
});
