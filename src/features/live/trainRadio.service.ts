import type {
  WeddingLiveEventsQuery,
  WeddingLiveRealtimeClient,
  WeddingLiveRpcClient,
} from './weddingLive.service';

export const RADIO_PRESETS = [
  { id: 'departure', label: 'ОТПРАВЛЕНИЕ' },
  { id: 'toast', label: 'ПОДНЯТЬ БОКАЛЫ' },
  { id: 'quiet_carriage', label: 'ТИХИЙ ВАГОН' },
  { id: 'late_passenger', label: 'ОПОЗДАВШИЕ' },
  { id: 'kiss', label: 'ПОЦЕЛУЙ' },
  { id: 'dance', label: 'ТАНЦПОЛ' },
  { id: 'quiz', label: 'КВИЗ' },
  { id: 'arena', label: 'АРЕНА' },
  { id: 'bunker', label: 'СИГНАЛ' },
  { id: 'final', label: 'КОНЕЧНАЯ' },
] as const;

export type RadioPresetId = typeof RADIO_PRESETS[number]['id'];

export type SendRadioTransmissionResult = {
  status: 'sent';
  eventId: string;
  preset: RadioPresetId;
  durationMs: number;
};

export type RadioTransmissionScreenEvent = {
  id: string;
  kind: 'radio_transmission';
  createdAt: string;
  preset: RadioPresetId;
  label: string;
  message: string;
  durationMs: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRadioPreset(value: unknown): value is RadioPresetId {
  return typeof value === 'string'
    && RADIO_PRESETS.some((preset) => preset.id === value);
}

function duration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 3000 || value > 20000) {
    throw new Error('Unexpected radio duration');
  }
  return Math.round(value);
}

export function parseSendRadioTransmissionResult(value: unknown): SendRadioTransmissionResult {
  if (!isRecord(value)
    || value.status !== 'sent'
    || typeof value.eventId !== 'string'
    || !isRadioPreset(value.preset)) {
    throw new Error('Unexpected radio transmission response');
  }
  return {
    status: 'sent',
    eventId: value.eventId,
    preset: value.preset,
    durationMs: duration(value.durationMs),
  };
}

export function parseRadioTransmissionScreenEvent(
  row: Record<string, unknown>,
): RadioTransmissionScreenEvent | null {
  if (
    typeof row.id !== 'string'
    || row.kind !== 'radio_transmission'
    || typeof row.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
    || !isRecord(row.payload)
    || !isRadioPreset(row.payload.preset)
    || typeof row.payload.label !== 'string'
    || row.payload.label.trim().length === 0
    || typeof row.payload.message !== 'string'
    || row.payload.message.trim().length === 0
  ) {
    return null;
  }
  let durationMs: number;
  try {
    durationMs = duration(row.payload.durationMs);
  } catch {
    return null;
  }
  return {
    id: row.id,
    kind: 'radio_transmission',
    createdAt: row.created_at,
    preset: row.payload.preset,
    label: row.payload.label.trim(),
    message: row.payload.message.trim(),
    durationMs,
  };
}

export async function sendTrainRadioTransmission(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  preset: RadioPresetId,
): Promise<SendRadioTransmissionResult> {
  const { data, error } = await client.rpc('owner_send_train_radio', {
    p_event_slug: eventSlug,
    p_preset: preset,
  });
  if (error) throw error;
  return parseSendRadioTransmissionResult(data);
}

export function subscribeToTrainRadio(
  client: WeddingLiveRealtimeClient,
  eventSlug: string,
  onEvent: (event: RadioTransmissionScreenEvent) => void,
): () => void {
  const channel = client.channel(`wedding-live-radio:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseRadioTransmissionScreenEvent(row);
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
        .eq('kind', 'radio_transmission')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) {
        if (isRecord(raw)) deliver(raw);
      }
    } catch {
      // Realtime is primary; the next catch-up can recover a missed transmission.
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
