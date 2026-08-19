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
  subscribeTimeoutMs = 800,
): Promise<void> {
  const channel = client.channel(`bunker:${eventSlug}`);
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
      await channel.send({ type: 'broadcast', event: 'refresh', payload: {} });
    } catch {
      // The authoritative RPC mutation has already succeeded. Realtime is only an
      // invalidation hint; phone/TV polling will converge if this send is lost.
    }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    void channel.unsubscribe();
  }
}
