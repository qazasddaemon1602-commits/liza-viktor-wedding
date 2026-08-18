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
): Promise<void> {
  const channel = client.channel(`mk:${eventSlug}`);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    channel.subscribe((status) => {
      if (settled) return;
      if (status === 'SUBSCRIBED') {
        settled = true;
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        settled = true;
        reject(new Error(`Unable to subscribe MK channel: ${status}`));
      }
    });
  });

  try {
    await channel.send({ type: 'broadcast', event: 'refresh', payload: {} });
  } finally {
    void channel.unsubscribe();
  }
}
