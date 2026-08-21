import { siteAudio } from '../../lib/siteAudio';

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

type SharedPresenceSubscription = {
  channel: PremierePresenceRealtimeChannel;
  listeners: Set<(presence: PremiereScreenPresence) => void>;
};

const sharedSubscriptions = new WeakMap<
  PremierePresenceRealtimeClient,
  Map<string, SharedPresenceSubscription>
>();

function presenceTopic(eventSlug: string): string {
  return `premiere-presence:${eventSlug}`;
}

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

function getOrCreateSharedSubscription(
  client: PremierePresenceRealtimeClient,
  eventSlug: string,
): SharedPresenceSubscription {
  let byEvent = sharedSubscriptions.get(client);
  if (!byEvent) {
    byEvent = new Map();
    sharedSubscriptions.set(client, byEvent);
  }

  const existing = byEvent.get(eventSlug);
  if (existing) return existing;

  const listeners = new Set<(presence: PremiereScreenPresence) => void>();
  const channel = client.channel(presenceTopic(eventSlug));
  const shared: SharedPresenceSubscription = { channel, listeners };

  channel
    .on('broadcast', { event: 'screen_presence' }, (message) => {
      const presence = parsePresence(message);
      if (!presence) return;
      for (const listener of [...listeners]) listener(presence);
    })
    .subscribe();

  byEvent.set(eventSlug, shared);
  return shared;
}

export function subscribeToPremiereScreenPresence(
  client: PremierePresenceRealtimeClient,
  eventSlug: string,
  onPresence: (presence: PremiereScreenPresence) => void,
): () => void {
  const shared = getOrCreateSharedSubscription(client, eventSlug);
  shared.listeners.add(onPresence);
  let active = true;

  return () => {
    if (!active) return;
    active = false;
    shared.listeners.delete(onPresence);
    if (shared.listeners.size > 0) return;

    const byEvent = sharedSubscriptions.get(client);
    if (byEvent?.get(eventSlug) === shared) {
      byEvent.delete(eventSlug);
      if (byEvent.size === 0) sharedSubscriptions.delete(client);
    }
    void shared.channel.unsubscribe();
  };
}

export function withDeviceAudioPresence(presence: PremiereScreenPresence): PremiereScreenPresence {
  const deviceAllowsAudio = siteAudio.isEnabled() && siteAudio.getVolume() > 0;
  return {
    ...presence,
    audioArmed: deviceAllowsAudio && (presence.audioArmed || siteAudio.isArmed()),
  };
}

export async function broadcastPremiereScreenPresence(
  client: PremierePresenceRealtimeClient,
  eventSlug: string,
  presence: PremiereScreenPresence,
): Promise<void> {
  const channel = client.channel(presenceTopic(eventSlug));

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
      payload: withDeviceAudioPresence(presence),
    });
  } finally {
    void channel.unsubscribe();
  }
}

