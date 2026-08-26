import type {
  WeddingLiveEventsQuery,
  WeddingLiveRealtimeClient,
  WeddingLiveRpcClient,
} from './weddingLive.service';

export type IlyaSongAction = 'play' | 'stop';

export type IlyaSongScreenEvent = {
  id: string;
  kind: 'ilya_song';
  createdAt: string;
} & ({
  action: 'play';
  title: string;
  artist: string;
  durationMs: number;
} | {
  action: 'stop';
});

export type ControlIlyaSongResult = {
  status: 'ok';
  eventId: string;
  action: IlyaSongAction;
};

export const ILYA_SONG_AUDIO_SOURCE = '/audio/live/ilya-toast.mp3';
export const ILYA_SONG_DURATION_MS = 233_080;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAction(value: unknown): value is IlyaSongAction {
  return value === 'play' || value === 'stop';
}

export function parseControlIlyaSongResult(value: unknown): ControlIlyaSongResult {
  if (!isRecord(value)
    || value.status !== 'ok'
    || typeof value.eventId !== 'string'
    || value.eventId.length === 0
    || !isAction(value.action)) {
    throw new Error('Unexpected Ilya song control response');
  }
  return { status: 'ok', eventId: value.eventId, action: value.action };
}

export function parseIlyaSongScreenEvent(row: Record<string, unknown>): IlyaSongScreenEvent | null {
  if (typeof row.id !== 'string'
    || row.id.length === 0
    || row.kind !== 'ilya_song'
    || typeof row.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
    || !isRecord(row.payload)
    || !isAction(row.payload.action)) {
    return null;
  }

  const base = { id: row.id, kind: 'ilya_song' as const, createdAt: row.created_at };
  if (row.payload.action === 'stop') return { ...base, action: 'stop' };
  if (typeof row.payload.title !== 'string'
    || row.payload.title.trim().length === 0
    || typeof row.payload.artist !== 'string'
    || row.payload.artist.trim().length === 0
    || typeof row.payload.durationMs !== 'number'
    || !Number.isFinite(row.payload.durationMs)
    || row.payload.durationMs < 10_000
    || row.payload.durationMs > 300_000) {
    return null;
  }
  return {
    ...base,
    action: 'play',
    title: row.payload.title.trim(),
    artist: row.payload.artist.trim(),
    durationMs: Math.round(row.payload.durationMs),
  };
}

export async function controlIlyaSong(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  action: IlyaSongAction,
): Promise<ControlIlyaSongResult> {
  const { data, error } = await client.rpc('owner_control_ilya_song', {
    p_event_slug: eventSlug,
    p_action: action,
  });
  if (error) throw error;
  return parseControlIlyaSongResult(data);
}

export function subscribeToIlyaSong(
  client: WeddingLiveRealtimeClient,
  eventSlug: string,
  onEvent: (event: IlyaSongScreenEvent) => void,
): () => void {
  const channel = client.channel(`wedding-live-ilya-song:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseIlyaSongScreenEvent(row);
    if (!event || delivered.has(event.id)) return;
    delivered.add(event.id);
    onEvent(event);
  };

  const catchUp = async () => {
    if (!active || !client.from) return;
    try {
      const query = client.from('screen_events').select('id,kind,created_at,payload') as WeddingLiveEventsQuery;
      const { data, error } = await query
        .eq('event_slug', eventSlug)
        .eq('kind', 'ilya_song')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) if (isRecord(raw)) deliver(raw);
    } catch {
      // Realtime is primary; polling recovers a missed projector event.
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
