import type {
  WeddingLiveEventsQuery,
  WeddingLiveRealtimeClient,
  WeddingLiveRpcClient,
} from './weddingLive.service';

export type SendTrainSoundResult = {
  status: 'sent';
  eventId: string;
};

export type TrainSoundScreenEvent = {
  id: string;
  kind: 'train_sound';
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseSendTrainSoundResult(value: unknown): SendTrainSoundResult {
  if (!isRecord(value) || value.status !== 'sent' || typeof value.eventId !== 'string' || value.eventId.length === 0) {
    throw new Error('Unexpected train sound response');
  }
  return { status: 'sent', eventId: value.eventId };
}

export function parseTrainSoundScreenEvent(row: Record<string, unknown>): TrainSoundScreenEvent | null {
  if (
    typeof row.id !== 'string'
    || row.id.length === 0
    || row.kind !== 'train_sound'
    || typeof row.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
  ) {
    return null;
  }
  return { id: row.id, kind: 'train_sound', createdAt: row.created_at };
}

export async function sendTrainSound(
  client: WeddingLiveRpcClient,
  eventSlug: string,
): Promise<SendTrainSoundResult> {
  const { data, error } = await client.rpc('owner_send_train_sound', { p_event_slug: eventSlug });
  if (error) throw error;
  return parseSendTrainSoundResult(data);
}

export function subscribeToTrainSound(
  client: WeddingLiveRealtimeClient,
  eventSlug: string,
  onEvent: (event: TrainSoundScreenEvent) => void,
): () => void {
  const channel = client.channel(`wedding-live-train-sound:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseTrainSoundScreenEvent(row);
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
        .eq('kind', 'train_sound')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) {
        if (isRecord(raw)) deliver(raw);
      }
    } catch {
      // Realtime is primary; a short catch-up window recovers missed commands.
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
