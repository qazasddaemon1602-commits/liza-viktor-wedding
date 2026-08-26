import type {
  WeddingLiveEventsQuery,
  WeddingLiveRealtimeClient,
  WeddingLiveRpcClient,
} from './weddingLive.service';

export type IlyaSongAction = 'play' | 'stop';

export const WEDDING_MUSIC_TRACKS = [
  {
    id: 'ilya-toast',
    title: 'Песня про Илью',
    artist: 'Посажёный отец',
    durationMs: 233_080,
    audioSource: '/audio/live/ilya-toast.mp3',
  },
  {
    id: 'koshkin-dom',
    title: 'Кошкин дом',
    artist: 'Свадебный плейлист',
    durationMs: 347_680,
    audioSource: '/audio/live/koshkin-dom.mp3',
  },
  {
    id: 'koshkin-dom-2',
    title: 'Кошкин дом — версия 2',
    artist: 'Свадебный плейлист',
    durationMs: 350_281,
    audioSource: '/audio/live/koshkin-dom-2.mp3',
  },
  {
    id: 'koshkin-dom-3',
    title: 'Кошкин дом — версия 3',
    artist: 'Свадебный плейлист',
    durationMs: 354_721,
    audioSource: '/audio/live/koshkin-dom-3.mp3',
  },
  {
    id: 'last-route',
    title: 'Последний маршрут',
    artist: 'Свадебный плейлист',
    durationMs: 227_440,
    audioSource: '/audio/live/last-route.mp3',
  },
] as const;

export type WeddingMusicTrackId = typeof WEDDING_MUSIC_TRACKS[number]['id'];

export function getWeddingMusicTrack(trackId: WeddingMusicTrackId) {
  return WEDDING_MUSIC_TRACKS.find((track) => track.id === trackId) ?? WEDDING_MUSIC_TRACKS[0];
}

function isTrackId(value: unknown): value is WeddingMusicTrackId {
  return typeof value === 'string' && WEDDING_MUSIC_TRACKS.some((track) => track.id === value);
}

export type IlyaSongScreenEvent = {
  id: string;
  kind: 'ilya_song';
  createdAt: string;
} & ({
  action: 'play';
  trackId: WeddingMusicTrackId;
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

export const ILYA_SONG_AUDIO_SOURCE = WEDDING_MUSIC_TRACKS[0].audioSource;
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
  const trackId = isTrackId(row.payload.trackId)
    ? row.payload.trackId
    : row.payload.title === WEDDING_MUSIC_TRACKS[0].title ? 'ilya-toast' : null;
  if (!trackId
    || typeof row.payload.title !== 'string'
    || row.payload.title.trim().length === 0
    || typeof row.payload.artist !== 'string'
    || row.payload.artist.trim().length === 0
    || typeof row.payload.durationMs !== 'number'
    || !Number.isFinite(row.payload.durationMs)
    || row.payload.durationMs < 10_000
    || row.payload.durationMs > 600_000) {
    return null;
  }
  return {
    ...base,
    action: 'play',
    trackId,
    title: row.payload.title.trim(),
    artist: row.payload.artist.trim(),
    durationMs: Math.round(row.payload.durationMs),
  };
}

export async function controlIlyaSong(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  action: IlyaSongAction,
  trackId?: WeddingMusicTrackId,
): Promise<ControlIlyaSongResult> {
  const { data, error } = await client.rpc('owner_control_ilya_song', {
    p_event_slug: eventSlug,
    p_action: action,
    ...(trackId ? { p_track_id: trackId } : {}),
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
