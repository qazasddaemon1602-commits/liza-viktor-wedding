export type BunkerRealtimeChannel = {
  send: (message: {
    type: 'broadcast';
    event: 'refresh';
    payload: Record<string, never>;
  }) => PromiseLike<unknown>;
  on: (
    type: 'broadcast',
    filter: { event: 'refresh' },
    callback: (payload: unknown) => void,
  ) => BunkerRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => BunkerRealtimeChannel;
  unsubscribe: () => unknown;
};

export type BunkerRealtimeClient = {
  channel: (name: string) => BunkerRealtimeChannel;
};

export function subscribeToBunkerRefresh(
  client: BunkerRealtimeClient,
  eventSlug: string,
  onRefresh: () => void,
): () => void {
  const channel = client.channel(`bunker:${eventSlug}`);
  channel.on('broadcast', { event: 'refresh' }, () => onRefresh()).subscribe();
  return () => {
    void channel.unsubscribe();
  };
}

export async function broadcastBunkerRefresh(
  client: BunkerRealtimeClient,
  eventSlug: string,
): Promise<void> {
  const channel = client.channel(`bunker:${eventSlug}`);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    channel.subscribe((status) => {
      if (settled) return;
      if (status === 'SUBSCRIBED') {
        settled = true;
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        settled = true;
        reject(new Error(`Unable to subscribe bunker channel: ${status}`));
      }
    });
  });

  try {
    await channel.send({ type: 'broadcast', event: 'refresh', payload: {} });
  } finally {
    void channel.unsubscribe();
  }
}
