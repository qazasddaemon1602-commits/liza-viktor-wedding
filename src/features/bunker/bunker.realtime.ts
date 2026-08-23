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
  subscribed: boolean;
};

const sharedRefreshChannels = new WeakMap<
  BunkerRealtimeClient,
  Map<string, SharedRefreshChannel>
>();

function sharedChannel(
  client: BunkerRealtimeClient,
  eventSlug: string,
): { clientChannels: Map<string, SharedRefreshChannel>; shared: SharedRefreshChannel } {
  let clientChannels = sharedRefreshChannels.get(client);
  if (!clientChannels) {
    clientChannels = new Map();
    sharedRefreshChannels.set(client, clientChannels);
  }

  let shared = clientChannels.get(eventSlug);
  if (!shared) {
    shared = {
      channel: client.channel(`bunker:${eventSlug}`),
      listeners: new Set(),
      subscribed: false,
    };
    clientChannels.set(eventSlug, shared);
  }
  return { clientChannels, shared };
}

export function subscribeToBunkerRefresh(
  client: BunkerRealtimeClient,
  eventSlug: string,
  onRefresh: () => void,
): () => void {
  const { clientChannels, shared } = sharedChannel(client, eventSlug);
  if (!shared.subscribed) {
    shared.subscribed = true;
    shared.channel
      .on('broadcast', { event: 'refresh' }, () => {
        for (const listener of [...shared.listeners]) {
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
): Promise<void> {
  // A guest sender usually has no local TV subscriber. Supabase Channel#send
  // deliberately supports this publisher-only case (HTTP transport before a
  // subscription). Cache one transport per client/event so a mutation never
  // creates a channel per submit and a later local subscriber can reuse it.
  const { shared } = sharedChannel(client, eventSlug);
  try {
    await shared.channel.send({ type: 'broadcast', event: 'refresh', payload: {} });
  } catch {
    // The authoritative RPC mutation has already succeeded. Realtime is only an
    // invalidation hint; bounded phone/TV polling will converge if this send is lost.
  }
}

