export type PremiereScreenPresence = {
  screenId: string;
  videoReady: boolean;
  audioArmed: boolean;
};

export type PremierePresenceRealtimeChannel = {
  send: (message: {
    type: 'broadcast';
    event: 'screen_presence';
    payload: PremiereScreenPresence;
  }) => PromiseLike<unknown>;
  on: (
    type: 'broadcast',
    filter: { event: 'screen_presence' },
    callback: (message: unknown) => void,
  ) => PremierePresenceRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => PremierePresenceRealtimeChannel;
  unsubscribe: () => unknown;
};

export type PremierePresenceRealtimeClient = {
  channel: (name: string) => PremierePresenceRealtimeChannel;
};

function parsePresence(message: unknown): PremiereScreenPresence | null {
  if (typeof message !== 'object' || message === null) return null;
  const payload = 'payload' in message
    ? (message as { payload?: unknown }).payload
    : message;
  if (typeof payload !== 'object' || payload === null) return null;

  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.screenId !== 'string'
    || candidate.screenId.trim().length < 3
    || candidate.screenId.length > 160
    || typeof candidate.videoReady !== 'boolean'
    || typeof candidate.audioArmed !== 'boolean'
  ) {
    return null;
  }

  return {
    screenId: candidate.screenId,
    videoReady: candidate.videoReady,
    audioArmed: candidate.audioArmed,
  };
}

export function subscribeToPremiereScreenPresence(
  client: PremierePresenceRealtimeClient,
  eventSlug: string,
  onPresence: (presence: PremiereScreenPresence) => void,
): () => void {
  const channel = client.channel(`premiere:${eventSlug}`);
  channel
    .on('broadcast', { event: 'screen_presence' }, (message) => {
      const presence = parsePresence(message);
      if (presence) onPresence(presence);
    })
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}

export async function broadcastPremiereScreenPresence(
  client: PremierePresenceRealtimeClient,
  eventSlug: string,
  presence: PremiereScreenPresence,
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
        reject(new Error(`Unable to subscribe premiere presence channel: ${status}`));
      }
    });
  });

  try {
    await channel.send({
      type: 'broadcast',
      event: 'screen_presence',
      payload: presence,
    });
  } finally {
    void channel.unsubscribe();
  }
}
