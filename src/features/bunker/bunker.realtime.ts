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

type SharedRefreshChannel = {
  channel: BunkerRealtimeChannel;
  listeners: Set<() => void>;
};

const sharedRefreshChannels = new WeakMap<
  BunkerRealtimeClient,
  Map<string, SharedRefreshChannel>
>();

export function subscribeToBunkerRefresh(
  client: BunkerRealtimeClient,
  eventSlug: string,
  onRefresh: () => void,
): () => void {
  let clientChannels = sharedRefreshChannels.get(client);
  if (!clientChannels) {
    clientChannels = new Map();
    sharedRefreshChannels.set(client, clientChannels);
  }

  let shared = clientChannels.get(eventSlug);
  if (!shared) {
    const listeners = new Set<() => void>();
    const channel = client.channel(`bunker:${eventSlug}`);
    shared = { channel, listeners };
    clientChannels.set(eventSlug, shared);
    channel
      .on('broadcast', { event: 'refresh' }, () => {
        for (const listener of [...listeners]) {
          try {
            listener();
          } catch {
            // One consumer must not prevent the remaining screens from refreshing.
          }
        }
      })
      .subscribe();
  }

  const subscription = shared;
  const registry = clientChannels;
  const listener = () => onRefresh();
  subscription.listeners.add(listener);
  let subscribed = true;

  return () => {
    if (!subscribed) return;
    subscribed = false;
    subscription.listeners.delete(listener);
    if (subscription.listeners.size > 0) return;

    registry.delete(eventSlug);
    if (registry.size === 0) sharedRefreshChannels.delete(client);
    void subscription.channel.unsubscribe();
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

