import { describe, expect, it, vi } from 'vitest';
import { broadcastMkRefresh, subscribeToMkRefresh, type MkRealtimeClient } from './mk.realtime';

function channelFixture() {
  let listener: (() => void) | undefined;
  const channel = {
    send: vi.fn().mockResolvedValue('ok'),
    on: vi.fn((_type: string, _filter: unknown, callback: () => void) => {
      listener = callback;
      return channel;
    }),
    subscribe: vi.fn((callback?: (status: string) => void) => {
      callback?.('SUBSCRIBED');
      return channel;
    }),
    unsubscribe: vi.fn(),
  };
  return { channel, emit: () => listener?.() };
}

describe('MK realtime refresh', () => {
  it('subscribes to the public refresh-only channel', () => {
    const fixture = channelFixture();
    const client: MkRealtimeClient = { channel: vi.fn().mockReturnValue(fixture.channel) };
    const refresh = vi.fn();

    const unsubscribe = subscribeToMkRefresh(client, 'liza-viktor', refresh);
    fixture.emit();

    expect(client.channel).toHaveBeenCalledWith('mk:liza-viktor');
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(fixture.channel.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('broadcasts only a refresh signal without tournament data', async () => {
    const fixture = channelFixture();
    const client: MkRealtimeClient = { channel: vi.fn().mockReturnValue(fixture.channel) };

    await broadcastMkRefresh(client, 'liza-viktor');

    expect(fixture.channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
  });

  it('times out and unsubscribes when the subscribe status never arrives', async () => {
    const channel = {
      send: vi.fn().mockResolvedValue('ok'),
      on: vi.fn(),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(),
    };
    const client: MkRealtimeClient = { channel: vi.fn().mockReturnValue(channel) };

    await expect(broadcastMkRefresh(client, 'liza-viktor', 10)).rejects.toThrow(
      /SUBSCRIBE_TIMEOUT/,
    );
    expect(channel.send).not.toHaveBeenCalled();
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
