export type CarriageCallRealtimeChannel = {
  send: (message: {
    type: 'broadcast';
    event: 'refresh';
    payload: Record<string, never>;
  }) => PromiseLike<unknown>;
  on: (
    type: 'broadcast',
    filter: { event: 'refresh' },
    callback: (payload: unknown) => void,
  ) => CarriageCallRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => CarriageCallRealtimeChannel;
  unsubscribe: () => unknown;
};

export type CarriageCallRealtimeClient = {
  channel: (name: string) => CarriageCallRealtimeChannel;
};

export async function broadcastCarriageCallRefresh(
  client: CarriageCallRealtimeClient,
  carriageIds: readonly string[],
): Promise<void> {
  const uniqueIds = [...new Set(carriageIds)];

  await Promise.all(uniqueIds.map(async (carriageId) => {
    const channel = client.channel(`carriage-call:${carriageId}`);
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
          reject(new Error(`Unable to subscribe carriage channel: ${status}`));
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
  }));
}

export function subscribeToCarriageCallRefresh(
  client: CarriageCallRealtimeClient,
  carriageId: string,
  onRefresh: () => void,
): () => void {
  const channel = client.channel(`carriage-call:${carriageId}`);
  channel
    .on('broadcast', { event: 'refresh' }, () => onRefresh())
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
