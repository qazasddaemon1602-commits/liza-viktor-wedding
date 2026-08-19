import { describe, expect, it, vi } from 'vitest';
import { broadcastBunkerRefresh, type BunkerRealtimeClient } from './bunker.realtime';

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
  it('sends only a refresh invalidation signal', async () => {
    const { client, send, unsubscribe } = fixture();
    await broadcastBunkerRefresh(client, 'liza-viktor');
    expect(send).toHaveBeenCalledWith({ type: 'broadcast', event: 'refresh', payload: {} });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not freeze owner controls when subscription status never arrives', async () => {
    const { client, channel, send, unsubscribe } = fixture();
    channel.subscribe.mockImplementation(() => channel);
    await expect(broadcastBunkerRefresh(client, 'liza-viktor', 20)).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('treats refresh send failure as best-effort after mutation success', async () => {
    const { client, send } = fixture();
    send.mockRejectedValueOnce(new Error('offline'));
    await expect(broadcastBunkerRefresh(client, 'liza-viktor')).resolves.toBeUndefined();
  });
});
