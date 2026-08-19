export type QuizRealtimeChannel = {
  send: (message: {
    type: 'broadcast';
    event: 'refresh';
    payload: Record<string, never>;
  }) => PromiseLike<unknown>;
  on: (
    type: 'broadcast',
    filter: { event: 'refresh' },
    callback: (payload: unknown) => void,
  ) => QuizRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => QuizRealtimeChannel;
  unsubscribe: () => unknown;
};

export type QuizRealtimeClient = {
  channel: (name: string) => QuizRealtimeChannel;
};

export function subscribeToQuizRefresh(
  client: QuizRealtimeClient,
  eventSlug: string,
  onRefresh: () => void,
): () => void {
  const channel = client.channel(`quiz:${eventSlug}`);
  channel
    .on('broadcast', { event: 'refresh' }, () => onRefresh())
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}

export async function broadcastQuizRefresh(
  client: QuizRealtimeClient,
  eventSlug: string,
  subscribeTimeoutMs = 800,
): Promise<void> {
  const channel = client.channel(`quiz:${eventSlug}`);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const subscribed = await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        resolve(value);
      };

      timeoutId = setTimeout(() => finish(false), subscribeTimeoutMs);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') finish(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') finish(false);
      });
    });

    if (!subscribed) return;

    try {
      await channel.send({
        type: 'broadcast',
        event: 'refresh',
        payload: {},
      });
    } catch {
      // The mutation already succeeded. Clients have polling/focus fallbacks, so a failed
      // invalidation signal must never freeze the owner UI or make the mutation look failed.
    }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    void channel.unsubscribe();
  }
}
