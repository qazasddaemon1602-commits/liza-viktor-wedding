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
): Promise<void> {
  const channel = client.channel(`quiz:${eventSlug}`);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    channel.subscribe((status) => {
      if (settled) return;
      if (status === 'SUBSCRIBED') {
        settled = true;
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        settled = true;
        reject(new Error(`Unable to subscribe quiz channel: ${status}`));
      }
    });
  });

  try {
    await channel.send({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
  } finally {
    void channel.unsubscribe();
  }
}
