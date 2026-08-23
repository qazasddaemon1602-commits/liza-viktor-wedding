import type {
  WeddingLiveEventsQuery,
  WeddingLiveRealtimeClient,
  WeddingLiveRpcClient,
} from './weddingLive.service';

export type EveningNomination = {
  key: string;
  title: string;
  recipient: string;
  detail: string;
};

export type EveningNominationsControl = {
  status: 'ok';
  nominations: EveningNomination[];
};

export type EveningNominationsScreenEvent = {
  id: string;
  kind: 'evening_nominations';
  createdAt: string;
  nominations: EveningNomination[];
};

export type PublishEveningNominationsResult =
  | { status: 'empty'; publishedCount: 0 }
  | { status: 'published'; eventId: string; publishedCount: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseNomination(value: unknown): EveningNomination | null {
  if (!isRecord(value)
    || typeof value.key !== 'string'
    || typeof value.title !== 'string'
    || typeof value.recipient !== 'string'
    || typeof value.detail !== 'string'
    || !value.key.trim()
    || !value.title.trim()
    || !value.recipient.trim()) {
    return null;
  }
  return {
    key: value.key.trim(),
    title: value.title.trim(),
    recipient: value.recipient.trim(),
    detail: value.detail.trim(),
  };
}

function parseNominationArray(value: unknown): EveningNomination[] {
  if (!Array.isArray(value)) throw new Error('Unexpected nominations list');
  const nominations = value.map(parseNomination);
  if (nominations.some((nomination) => nomination === null)) {
    throw new Error('Unexpected nomination entry');
  }
  return nominations as EveningNomination[];
}

export function parseEveningNominationsControl(value: unknown): EveningNominationsControl {
  if (!isRecord(value) || value.status !== 'ok') {
    throw new Error('Unexpected nominations response');
  }
  return { status: 'ok', nominations: parseNominationArray(value.nominations) };
}

export function parseEveningNominationsScreenEvent(
  row: Record<string, unknown>,
): EveningNominationsScreenEvent | null {
  if (
    typeof row.id !== 'string'
    || row.kind !== 'evening_nominations'
    || typeof row.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
    || !isRecord(row.payload)
  ) {
    return null;
  }
  try {
    const nominations = parseNominationArray(row.payload.nominations);
    if (!nominations.length) return null;
    return {
      id: row.id,
      kind: 'evening_nominations',
      createdAt: row.created_at,
      nominations,
    };
  } catch {
    return null;
  }
}

export async function getOwnerEveningNominations(
  client: WeddingLiveRpcClient,
  eventSlug: string,
): Promise<EveningNominationsControl> {
  const { data, error } = await client.rpc('owner_get_evening_nominations', {
    p_event_slug: eventSlug,
  });
  if (error) throw error;
  return parseEveningNominationsControl(data);
}

export async function publishOwnerEveningNominations(
  client: WeddingLiveRpcClient,
  eventSlug: string,
): Promise<PublishEveningNominationsResult> {
  const { data, error } = await client.rpc('owner_publish_evening_nominations', {
    p_event_slug: eventSlug,
  });
  if (error) throw error;
  if (!isRecord(data)) throw new Error('Unexpected nominations publish response');
  if (data.status === 'empty') return { status: 'empty', publishedCount: 0 };
  if (data.status !== 'published'
    || typeof data.eventId !== 'string'
    || typeof data.publishedCount !== 'number'
    || !Number.isFinite(data.publishedCount)
    || data.publishedCount < 0) {
    throw new Error('Unexpected nominations publish response');
  }
  return {
    status: 'published',
    eventId: data.eventId,
    publishedCount: Math.round(data.publishedCount),
  };
}

export function subscribeToEveningNominations(
  client: WeddingLiveRealtimeClient,
  eventSlug: string,
  onEvent: (event: EveningNominationsScreenEvent) => void,
): () => void {
  const channel = client.channel(`wedding-live-nominations:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseEveningNominationsScreenEvent(row);
    if (!event || delivered.has(event.id)) return;
    delivered.add(event.id);
    onEvent(event);
  };

  const catchUp = async () => {
    if (!active || !client.from) return;
    try {
      const query = client
        .from('screen_events')
        .select('id,kind,created_at,payload') as WeddingLiveEventsQuery;
      const { data, error } = await query
        .eq('event_slug', eventSlug)
        .eq('kind', 'evening_nominations')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) {
        if (isRecord(raw)) deliver(raw);
      }
    } catch {
      // Realtime remains primary; catch-up recovers a missed final overlay.
    }
  };

  channel.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'screen_events', filter: `event_slug=eq.${eventSlug}`,
  }, (payload) => {
    if (payload.new) deliver(payload.new);
  }).subscribe((status) => {
    if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      void catchUp();
    }
  });

  void catchUp();
  const interval = client.from ? setInterval(() => { void catchUp(); }, 1_500) : undefined;
  return () => {
    active = false;
    if (interval !== undefined) clearInterval(interval);
    void channel.unsubscribe();
  };
}
