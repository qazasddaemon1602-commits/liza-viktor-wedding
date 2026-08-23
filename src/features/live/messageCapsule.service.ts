import type {
  WeddingLiveEventsQuery,
  WeddingLiveRealtimeClient,
  WeddingLiveRpcClient,
} from './weddingLive.service';

export type GuestMessageCapsuleState =
  | { status: 'not_found' | 'not_registered' }
  | {
      status: 'ready';
      open: boolean;
      maxLength: number;
      message: string | null;
      updatedAt: string | null;
    };

export type SaveGuestMessageResult =
  | { status: 'closed' }
  | { status: 'saved'; message: string; updatedAt: string };

export type CapsuleMessage = {
  guestId: string;
  displayName: string;
  carriage: string;
  message: string;
  updatedAt: string;
};

export type OwnerMessageCapsuleControl =
  | { status: 'not_found' }
  | { status: 'ok'; open: boolean; count: number; messages: CapsuleMessage[] };

export type CapsuleShowcaseMessage = {
  displayName: string;
  carriage: string;
  message: string;
};

export type CapsuleShowcaseScreenEvent = {
  id: string;
  kind: 'capsule_showcase';
  createdAt: string;
  messages: CapsuleShowcaseMessage[];
};

export type PublishCapsuleResult =
  | { status: 'empty'; publishedCount: 0 }
  | { status: 'published'; eventId: string; publishedCount: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function timestampOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('Unexpected capsule timestamp');
  }
  return value;
}

function nonNegativeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Unexpected capsule count');
  }
  return Math.round(value);
}

export function parseGuestMessageCapsuleState(value: unknown): GuestMessageCapsuleState {
  if (!isRecord(value) || typeof value.status !== 'string') {
    throw new Error('Unexpected capsule response');
  }
  if (value.status === 'not_found' || value.status === 'not_registered') {
    return { status: value.status };
  }
  if (
    value.status !== 'ready'
    || typeof value.open !== 'boolean'
    || typeof value.maxLength !== 'number'
    || !Number.isFinite(value.maxLength)
    || value.maxLength < 1
    || !(value.message === null || typeof value.message === 'string')
  ) {
    throw new Error('Unexpected capsule response');
  }
  return {
    status: 'ready',
    open: value.open,
    maxLength: Math.round(value.maxLength),
    message: value.message,
    updatedAt: timestampOrNull(value.updatedAt),
  };
}

export function parseSaveGuestMessageResult(value: unknown): SaveGuestMessageResult {
  if (!isRecord(value)) throw new Error('Unexpected capsule save response');
  if (value.status === 'closed') return { status: 'closed' };
  if (value.status !== 'saved' || typeof value.message !== 'string') {
    throw new Error('Unexpected capsule save response');
  }
  const updatedAt = timestampOrNull(value.updatedAt);
  if (!updatedAt) throw new Error('Unexpected capsule save timestamp');
  return { status: 'saved', message: value.message, updatedAt };
}

function parseCapsuleMessage(value: unknown): CapsuleMessage {
  if (!isRecord(value)
    || typeof value.guestId !== 'string'
    || typeof value.displayName !== 'string'
    || typeof value.carriage !== 'string'
    || typeof value.message !== 'string') {
    throw new Error('Unexpected owner capsule message');
  }
  const updatedAt = timestampOrNull(value.updatedAt);
  if (!updatedAt) throw new Error('Unexpected owner capsule timestamp');
  return {
    guestId: value.guestId,
    displayName: value.displayName,
    carriage: value.carriage,
    message: value.message,
    updatedAt,
  };
}

export function parseOwnerMessageCapsuleControl(value: unknown): OwnerMessageCapsuleControl {
  if (!isRecord(value)) throw new Error('Unexpected owner capsule response');
  if (value.status === 'not_found') return { status: 'not_found' };
  if (value.status !== 'ok'
    || typeof value.open !== 'boolean'
    || !Array.isArray(value.messages)) {
    throw new Error('Unexpected owner capsule response');
  }
  return {
    status: 'ok',
    open: value.open,
    count: nonNegativeInteger(value.count),
    messages: value.messages.map(parseCapsuleMessage),
  };
}

function parseShowcaseMessage(value: unknown): CapsuleShowcaseMessage | null {
  if (!isRecord(value)
    || typeof value.displayName !== 'string'
    || value.displayName.trim().length === 0
    || typeof value.carriage !== 'string'
    || value.carriage.trim().length === 0
    || typeof value.message !== 'string'
    || value.message.trim().length === 0) {
    return null;
  }
  return {
    displayName: value.displayName.trim(),
    carriage: value.carriage.trim(),
    message: value.message.trim(),
  };
}

export function parseCapsuleShowcaseScreenEvent(
  row: Record<string, unknown>,
): CapsuleShowcaseScreenEvent | null {
  if (
    typeof row.id !== 'string'
    || row.kind !== 'capsule_showcase'
    || typeof row.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
    || !isRecord(row.payload)
    || !Array.isArray(row.payload.messages)
  ) {
    return null;
  }
  const messages = row.payload.messages.map(parseShowcaseMessage);
  if (messages.length === 0 || messages.some((message) => message === null)) return null;
  return {
    id: row.id,
    kind: 'capsule_showcase',
    createdAt: row.created_at,
    messages: messages as CapsuleShowcaseMessage[],
  };
}

export async function getGuestMessageCapsule(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<GuestMessageCapsuleState> {
  const { data, error } = await client.rpc('get_guest_message_capsule', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throw error;
  return parseGuestMessageCapsuleState(data);
}

export async function saveGuestMessageCapsule(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  deviceKey: string,
  message: string,
): Promise<SaveGuestMessageResult> {
  const { data, error } = await client.rpc('save_guest_message_capsule', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_message: message,
  });
  if (error) throw error;
  return parseSaveGuestMessageResult(data);
}

export async function getOwnerMessageCapsule(
  client: WeddingLiveRpcClient,
  eventSlug: string,
): Promise<OwnerMessageCapsuleControl> {
  const { data, error } = await client.rpc('owner_get_message_capsule', {
    p_event_slug: eventSlug,
  });
  if (error) throw error;
  return parseOwnerMessageCapsuleControl(data);
}

export async function setOwnerMessageCapsuleOpen(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  open: boolean,
): Promise<{ status: 'ok'; open: boolean }> {
  const { data, error } = await client.rpc('owner_set_message_capsule_open', {
    p_event_slug: eventSlug,
    p_open: open,
  });
  if (error) throw error;
  if (!isRecord(data) || data.status !== 'ok' || typeof data.open !== 'boolean') {
    throw new Error('Unexpected capsule toggle response');
  }
  return { status: 'ok', open: data.open };
}

export async function publishOwnerMessageCapsule(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  limit = 7,
): Promise<PublishCapsuleResult> {
  const { data, error } = await client.rpc('owner_publish_message_capsule', {
    p_event_slug: eventSlug,
    p_limit: limit,
  });
  if (error) throw error;
  if (!isRecord(data)) throw new Error('Unexpected capsule publish response');
  if (data.status === 'empty') return { status: 'empty', publishedCount: 0 };
  if (data.status !== 'published' || typeof data.eventId !== 'string') {
    throw new Error('Unexpected capsule publish response');
  }
  return {
    status: 'published',
    eventId: data.eventId,
    publishedCount: nonNegativeInteger(data.publishedCount),
  };
}

export function subscribeToCapsuleShowcase(
  client: WeddingLiveRealtimeClient,
  eventSlug: string,
  onEvent: (event: CapsuleShowcaseScreenEvent) => void,
): () => void {
  const channel = client.channel(`wedding-live-capsule:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseCapsuleShowcaseScreenEvent(row);
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
        .eq('kind', 'capsule_showcase')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) {
        if (isRecord(raw)) deliver(raw);
      }
    } catch {
      // Realtime remains primary; a later catch-up recovers a missed showcase.
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
