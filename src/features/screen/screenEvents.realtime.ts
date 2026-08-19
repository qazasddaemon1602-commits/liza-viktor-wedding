import type { CarriageSummary } from '../registration/registration.types';
import type { GuestRegistrationScreenEvent } from './TrainArrivalScene';

type ScreenEventsRealtimePayload = {
  new?: Record<string, unknown>;
};

type ScreenEventsQueryResult = {
  data: unknown[] | null;
  error: { message?: string } | null;
};

type ScreenEventsQuery = {
  eq: (column: string, value: string) => ScreenEventsQuery;
  gt: (column: string, value: string) => ScreenEventsQuery;
  order: (column: string, options: { ascending: boolean }) => PromiseLike<ScreenEventsQueryResult>;
};

export type CarriageCallScreenEvent = {
  id: string;
  kind: 'carriage_call';
  createdAt: string;
  payload: {
    callId: string;
    message: string;
    carriages: CarriageSummary[];
  };
};

export type ScreenPresentationEvent = GuestRegistrationScreenEvent | CarriageCallScreenEvent;

export type ScreenEventsRealtimeChannel = {
  on: (
    eventType: 'postgres_changes',
    filter: {
      event: 'INSERT';
      schema: 'public';
      table: 'screen_events';
      filter: string;
    },
    callback: (payload: ScreenEventsRealtimePayload) => void,
  ) => ScreenEventsRealtimeChannel;
  subscribe: () => unknown;
  unsubscribe: () => unknown;
};

export type ScreenEventsRealtimeClient = {
  channel: (name: string) => ScreenEventsRealtimeChannel;
  from?: (table: string) => {
    select: (columns: string) => ScreenEventsQuery;
  };
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseCarriage(value: unknown): CarriageSummary | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (
    !nonEmptyString(raw.id)
    || typeof raw.number !== 'number'
    || !Number.isFinite(raw.number)
    || !nonEmptyString(raw.label)
    || !nonEmptyString(raw.accentHex)
    || !nonEmptyString(raw.visualMark)
  ) {
    return null;
  }

  return {
    id: raw.id,
    number: raw.number,
    label: raw.label,
    accentHex: raw.accentHex,
    visualMark: raw.visualMark,
  };
}

function parseGuestRegistrationEvent(row: Record<string, unknown>): GuestRegistrationScreenEvent | null {
  if (!nonEmptyString(row.id) || row.kind !== 'guest_registered' || !nonEmptyString(row.created_at)) {
    return null;
  }

  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) return null;

  const rawPayload = payload as Record<string, unknown>;
  if (!nonEmptyString(rawPayload.displayName)) return null;

  const carriage = parseCarriage(rawPayload.carriage);
  if (!carriage) return null;

  return {
    id: row.id,
    kind: 'guest_registered',
    createdAt: row.created_at,
    payload: {
      displayName: rawPayload.displayName.trim(),
      carriage,
    },
  };
}

function parseCarriageCallEvent(row: Record<string, unknown>): CarriageCallScreenEvent | null {
  if (!nonEmptyString(row.id) || row.kind !== 'carriage_call' || !nonEmptyString(row.created_at)) {
    return null;
  }

  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) return null;
  const rawPayload = payload as Record<string, unknown>;
  if (
    !nonEmptyString(rawPayload.callId)
    || !nonEmptyString(rawPayload.message)
    || !Array.isArray(rawPayload.carriages)
    || rawPayload.carriages.length === 0
  ) {
    return null;
  }

  const carriages = rawPayload.carriages.map(parseCarriage);
  if (carriages.some((carriage) => carriage === null)) return null;

  return {
    id: row.id,
    kind: 'carriage_call',
    createdAt: row.created_at,
    payload: {
      callId: rawPayload.callId,
      message: rawPayload.message.trim(),
      carriages: carriages as CarriageSummary[],
    },
  };
}

export function parseScreenEvent(row: Record<string, unknown>): ScreenPresentationEvent | null {
  if (row.kind === 'guest_registered') return parseGuestRegistrationEvent(row);
  if (row.kind === 'carriage_call') return parseCarriageCallEvent(row);
  return null;
}

export function subscribeToScreenEvents(
  client: ScreenEventsRealtimeClient,
  eventSlug: string,
  onEvent: (event: ScreenPresentationEvent) => void,
): () => void {
  const channel = client.channel(`screen-events:${eventSlug}`);
  const delivered = new Set<string>();
  let active = true;

  const deliver = (row: Record<string, unknown>) => {
    const event = parseScreenEvent(row);
    if (!event || delivered.has(event.id)) return;
    // Mark before handing off so events intentionally dropped by a protected projector
    // are not replayed after Premiere/MK/Bunker protection ends.
    delivered.add(event.id);
    onEvent(event);
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
    .subscribe();

  const catchUp = async () => {
    if (!active || !client.from) return;
    try {
      const { data, error } = await client
        .from('screen_events')
        .select('id,kind,created_at,payload')
        .eq('event_slug', eventSlug)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      if (error || !active || !Array.isArray(data)) return;
      for (const raw of data) {
        if (typeof raw === 'object' && raw !== null) deliver(raw as Record<string, unknown>);
      }
    } catch {
      // Realtime remains primary; a later catch-up attempt can recover a missed event.
    }
  };

  let interval: ReturnType<typeof setInterval> | undefined;
  if (client.from) {
    void catchUp();
    interval = setInterval(() => { void catchUp(); }, 1_500);
  }

  return () => {
    active = false;
    if (interval !== undefined) clearInterval(interval);
    void channel.unsubscribe();
  };
}
