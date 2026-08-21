import { describe, expect, it, vi } from 'vitest';
import {
  broadcastQuizRefresh,
  subscribeToQuizRefresh,
  type QuizRealtimeClient,
} from './quiz.realtime';

function realtimeHarness() {
  const send = vi.fn().mockResolvedValue(undefined);
  const unsubscribe = vi.fn();
  const on = vi.fn().mockReturnThis();
  const subscribe = vi.fn((callback?: (status: string) => void) => {
    callback?.('SUBSCRIBED');
    return channel;
  });
  const channel = { send, unsubscribe, on, subscribe };
  const client: QuizRealtimeClient = {
    channel: vi.fn().mockReturnValue(channel),
  };
  return { client, channel, send, unsubscribe, on, subscribe };
}

describe('quiz realtime refresh', () => {
  it('subscribes guests to one empty refresh signal for the event', () => {
    const { client, on, subscribe, unsubscribe } = realtimeHarness();
    const refresh = vi.fn();

    const cleanup = subscribeToQuizRefresh(client, 'liza-viktor', refresh);

    expect(client.channel).toHaveBeenCalledWith('quiz:liza-viktor');
    expect(on).toHaveBeenCalledWith('broadcast', { event: 'refresh' }, expect.any(Function));
    expect(subscribe).toHaveBeenCalled();

    on.mock.calls[0][2]({});
    expect(refresh).toHaveBeenCalledTimes(1);

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('broadcasts no question, answer, or result data', async () => {
    const { client, send, unsubscribe } = realtimeHarness();

    await broadcastQuizRefresh(client, 'liza-viktor');

    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does not freeze an owner action when the realtime channel never reports subscription status', async () => {
    const { client, channel, send, unsubscribe } = realtimeHarness();
    channel.subscribe.mockImplementation(() => channel);

    await expect(broadcastQuizRefresh(client, 'liza-viktor', 20)).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('treats a failed refresh send as best-effort after the database mutation already succeeded', async () => {
    const { client, send, unsubscribe } = realtimeHarness();
    send.mockRejectedValueOnce(new Error('offline'));

    await expect(broadcastQuizRefresh(client, 'liza-viktor')).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

