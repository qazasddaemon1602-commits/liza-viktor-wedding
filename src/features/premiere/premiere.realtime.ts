export type PremiereRealtimeChannel = {
  send: (message: {
    type: 'broadcast';
    event: 'refresh';
    payload: Record<string, never>;
  }) => PromiseLike<unknown>;
  on: (
    type: 'broadcast',
    filter: { event: 'refresh' },
    callback: (payload: unknown) => void,
  ) => PremiereRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => PremiereRealtimeChannel;
  unsubscribe: () => unknown;
};

export type PremiereRealtimeClient = {
  channel: (name: string) => PremiereRealtimeChannel;
};

export function subscribeToPremiereRefresh(
  client: PremiereRealtimeClient,
  eventSlug: string,
  onRefresh: () => void,
): () => void {
  const channel = client.channel(`premiere:${eventSlug}`);
  channel
    .on('broadcast', { event: 'refresh' }, () => onRefresh())
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}

export async function broadcastPremiereRefresh(
  client: PremiereRealtimeClient,
  eventSlug: string,
): Promise<void> {
  const channel = client.channel(`premiere:${eventSlug}`);
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
        reject(new Error(`Unable to subscribe premiere channel: ${status}`));
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
