export type MkRealtimeChannel = {
  send: (message: {
    type: 'broadcast';
    event: 'refresh';
    payload: Record<string, never>;
  }) => PromiseLike<unknown>;
  on: (
    type: 'broadcast',
    filter: { event: 'refresh' },
    callback: (payload: unknown) => void,
  ) => MkRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => MkRealtimeChannel;
  unsubscribe: () => unknown;
};

export type MkRealtimeClient = {
  channel: (name: string) => MkRealtimeChannel;
};

export function subscribeToMkRefresh(
  client: MkRealtimeClient,
  eventSlug: string,
  onRefresh: () => void,
): () => void {
  const channel = client.channel(`mk:${eventSlug}`);
  channel
    .on('broadcast', { event: 'refresh' }, () => onRefresh())
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}

export async function broadcastMkRefresh(
  client: MkRealtimeClient,
  eventSlug: string,
  subscribeTimeoutMs = 1200,
): Promise<void> {
  const channel = client.channel(`mk:${eventSlug}`);
  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('Unable to subscribe MK channel: SUBSCRIBE_TIMEOUT'));
      }, subscribeTimeoutMs);

      channel.subscribe((status) => {
        if (settled) return;
        if (status === 'SUBSCRIBED') {
          settled = true;
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(`Unable to subscribe MK channel: ${status}`));
        }
      });
    });

    await channel.send({ type: 'broadcast', event: 'refresh', payload: {} });
  } finally {
    void channel.unsubscribe();
  }
}
