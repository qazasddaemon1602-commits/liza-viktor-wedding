export const GUEST_REACTION_KEYS = ['heart', 'laugh', 'fire', 'clap', 'wow'] as const;

export type GuestReactionKey = typeof GUEST_REACTION_KEYS[number];

export type SubmitGuestReactionResult =
  | { status: 'accepted'; reactionId: string; createdAt: string; cooldownMs: number }
  | { status: 'cooldown'; retryAfterMs: number };

export type GuestReactionScreenEvent = {
  id: string;
  kind: 'guest_reaction';
  createdAt: string;
  reaction: GuestReactionKey;
};

export type WeddingLiveRpcError = Error | { message?: string; code?: string } | null;

export type WeddingLiveRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: WeddingLiveRpcError }>;
};

export type WeddingLiveQueryResult = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

export type WeddingLiveEventsQuery = {
  eq: (column: string, value: string) => WeddingLiveEventsQuery;
  gt: (column: string, value: string) => WeddingLiveEventsQuery;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => PromiseLike<WeddingLiveQueryResult>;
};

export type WeddingLiveRealtimeChannel = {
  on: (
    eventType: 'postgres_changes',
    filter: {
      event: 'INSERT';
      schema: 'public';
      table: 'screen_events';
      filter: string;
    },
    callback: (payload: { new?: Record<string, unknown> }) => void,
  ) => WeddingLiveRealtimeChannel;
  subscribe: (callback?: (status: string) => void) => unknown;
  unsubscribe: () => unknown;
};

export type WeddingLiveRealtimeClient = {
  channel: (name: string) => WeddingLiveRealtimeChannel;
  from?: (table: string) => {
    select: (columns: string) => WeddingLiveEventsQuery;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGuestReactionKey(value: unknown): value is GuestReactionKey {
  return typeof value === 'string'
    && (GUEST_REACTION_KEYS as readonly string[]).includes(value);
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('Unexpected wedding live timestamp');
  }
  return value;
}

function parseNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Unexpected wedding live ${label}`);
  }
  return Math.round(value);
}

export function reactionEmoji(reaction: GuestReactionKey | string): string | null {
  switch (reaction) {
    case 'heart': return '❤️';
    case 'laugh': return '😂';
    case 'fire': return '🔥';
    case 'clap': return '👏';
    case 'wow': return '😱';
    default: return null;
  }
}

export function parseSubmitGuestReactionResult(value: unknown): SubmitGuestReactionResult {
  if (!isRecord(value)) throw new Error('Unexpected wedding reaction response');

  if (value.status === 'cooldown') {
    return {
      status: 'cooldown',
      retryAfterMs: parseNonNegativeNumber(value.retryAfterMs, 'retryAfterMs'),
    };
  }

  if (
    value.status !== 'accepted'
    || typeof value.reactionId !== 'string'
    || value.reactionId.length === 0
  ) {
    throw new Error('Unexpected wedding reaction response');
  }

  return {
    status: 'accepted',
    reactionId: value.reactionId,
    createdAt: parseTimestamp(value.createdAt),
    cooldownMs: parseNonNegativeNumber(value.cooldownMs, 'cooldownMs'),
  };
}

export function parseGuestReactionScreenEvent(
  row: Record<string, unknown>,
): GuestReactionScreenEvent | null {
  if (
    typeof row.id !== 'string'
    || row.id.length === 0
    || row.kind !== 'guest_reaction'
    || typeof row.created_at !== 'string'
    || Number.isNaN(Date.parse(row.created_at))
    || !isRecord(row.payload)
    || !isGuestReactionKey(row.payload.reaction)
  ) {
    return null;
  }

  return {
    id: row.id,
    kind: 'guest_reaction',
    createdAt: row.created_at,
    reaction: row.payload.reaction,
  };
}

export async function submitGuestReaction(
  client: WeddingLiveRpcClient,
  eventSlug: string,
  deviceKey: string,
  reaction: GuestReactionKey,
): Promise<SubmitGuestReactionResult> {
  const { data, error } = await client.rpc('submit_guest_live_reaction', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_reaction: reaction,
  });
  if (error) throw error;
  return parseSubmitGuestReactionResult(data);
}

export function subscribeToGuestReactions(
  client: WeddingLiveRealtimeClient,
  eventSlug: string,
  onEvent: (event: GuestReactionScreenEvent) => void,
): () => void {
  const channel = client.channel(`wedding-live-reactions:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseGuestReactionScreenEvent(row);
    if (!event || delivered.has(event.id)) return;
    delivered.add(event.id);
    onEvent(event);
  };

  const catchUp = async () => {
    if (!active || !client.from) return;
    try {
      const { data, error } = await client
        .from('screen_events')
        .select('id,kind,created_at,payload')
        .eq('event_slug', eventSlug)
        .eq('kind', 'guest_reaction')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) {
        if (isRecord(raw)) deliver(raw);
      }
    } catch {
      // Realtime remains primary; the next catch-up can recover a missed reaction.
    }
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'screen_events',
        filter: `event_slug=eq.${eventSlug}`,
      },
      (payload) => {
        if (payload.new) deliver(payload.new);
      },
    )
    .subscribe((status) => {
      if (
        status === 'SUBSCRIBED'
        || status === 'CHANNEL_ERROR'
        || status === 'TIMED_OUT'
        || status === 'CLOSED'
      ) {
        void catchUp();
      }
    });

  void catchUp();
  const interval = client.from
    ? setInterval(() => { void catchUp(); }, 1_500)
    : undefined;

  const catchUpWhenVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') void catchUp();
  };
  const catchUpWhenOnline = () => { void catchUp(); };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', catchUpWhenVisible);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', catchUpWhenOnline);
  }

  return () => {
    active = false;
    if (interval !== undefined) clearInterval(interval);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', catchUpWhenVisible);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', catchUpWhenOnline);
    }
    void channel.unsubscribe();
  };
}
