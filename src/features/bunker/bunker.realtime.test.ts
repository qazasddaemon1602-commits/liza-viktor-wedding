import { describe, expect, it, vi } from 'vitest';
import {
  broadcastBunkerRefresh,
  subscribeToBunkerRefresh,
  type BunkerRealtimeClient,
} from './bunker.realtime';

function fixture() {
  const send = vi.fn().mockResolvedValue(undefined);
  const unsubscribe = vi.fn();
  const channel = {
    send,
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback?: (status: string) => void) => {
      callback?.('SUBSCRIBED');
      return channel;
    }),
    unsubscribe,
  };
  const client: BunkerRealtimeClient = { channel: vi.fn().mockReturnValue(channel) };
  return { client, channel, send, unsubscribe };
}

describe('broadcastBunkerRefresh', () => {
  it('reuses the shared subscribed transport instead of creating a channel per mutation', async () => {
    const { client, send, unsubscribe } = fixture();
    const stop = subscribeToBunkerRefresh(client, 'liza-viktor', vi.fn());
    await broadcastBunkerRefresh(client, 'liza-viktor');
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'broadcast', event: 'refresh', payload: {} });
    expect(unsubscribe).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('creates one cached publisher transport when the sender has no local subscriber', async () => {
    const { client, channel, send, unsubscribe } = fixture();
    await expect(broadcastBunkerRefresh(client, 'liza-viktor')).resolves.toBeUndefined();
    await expect(broadcastBunkerRefresh(client, 'liza-viktor')).resolves.toBeUndefined();
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(channel.subscribe).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(2);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('treats refresh send failure as best-effort after mutation success', async () => {
    const { client, send } = fixture();
    send.mockRejectedValueOnce(new Error('offline'));
    const stop = subscribeToBunkerRefresh(client, 'liza-viktor', vi.fn());
    await expect(broadcastBunkerRefresh(client, 'liza-viktor')).resolves.toBeUndefined();
    stop();
  });
});

describe('subscribeToBunkerRefresh', () => {
  it('shares one channel between subscribers and tears it down after the last unsubscribe', () => {
    const { client, channel, unsubscribe } = fixture();
    let receiveRefresh: (() => void) | undefined;
    channel.on.mockImplementation((_type, _filter, callback) => {
      receiveRefresh = callback as () => void;
      return channel;
    });
    const first = vi.fn();
    const second = vi.fn();

    const unsubscribeFirst = subscribeToBunkerRefresh(client, 'liza-viktor', first);
    const unsubscribeSecond = subscribeToBunkerRefresh(client, 'liza-viktor', second);

    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(channel.on).toHaveBeenCalledTimes(1);
    receiveRefresh?.();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(unsubscribe).not.toHaveBeenCalled();
    receiveRefresh?.();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);

    unsubscribeSecond();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps two subscriptions with the same callback independent', () => {
    const { client, channel, unsubscribe } = fixture();
    let receiveRefresh: (() => void) | undefined;
    channel.on.mockImplementation((_type, _filter, callback) => {
      receiveRefresh = callback as () => void;
      return channel;
    });
    const listener = vi.fn();

    const unsubscribeFirst = subscribeToBunkerRefresh(client, 'liza-viktor', listener);
    const unsubscribeSecond = subscribeToBunkerRefresh(client, 'liza-viktor', listener);

    receiveRefresh?.();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    expect(unsubscribe).not.toHaveBeenCalled();
    receiveRefresh?.();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribeSecond();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('continues fan-out when one listener throws', () => {
    const { client, channel } = fixture();
    let receiveRefresh: (() => void) | undefined;
    channel.on.mockImplementation((_type, _filter, callback) => {
      receiveRefresh = callback as () => void;
      return channel;
    });
    const throwing = vi.fn(() => { throw new Error('listener failed'); });
    const healthy = vi.fn();

    const unsubscribeThrowing = subscribeToBunkerRefresh(client, 'liza-viktor', throwing);
    const unsubscribeHealthy = subscribeToBunkerRefresh(client, 'liza-viktor', healthy);

    expect(() => receiveRefresh?.()).not.toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);

    unsubscribeThrowing();
    unsubscribeHealthy();
  });
});

