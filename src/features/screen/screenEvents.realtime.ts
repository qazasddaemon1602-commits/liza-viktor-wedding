import type { GuestRegistrationScreenEvent } from './TrainArrivalScene';

type ScreenEventsRealtimePayload = {
  new?: Record<string, unknown>;
};

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
};

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseGuestRegistrationEvent(row: Record<string, unknown>): GuestRegistrationScreenEvent | null {
  if (!nonEmptyString(row.id) || row.kind !== 'guest_registered' || !nonEmptyString(row.created_at)) {
    return null;
  }

  const payload = row.payload;
  if (typeof payload !== 'object' || payload === null) return null;

  const rawPayload = payload as Record<string, unknown>;
  if (!nonEmptyString(rawPayload.displayName)) return null;

  const carriage = rawPayload.carriage;
  if (typeof carriage !== 'object' || carriage === null) return null;
  const rawCarriage = carriage as Record<string, unknown>;

  if (
    !nonEmptyString(rawCarriage.id)
    || typeof rawCarriage.number !== 'number'
    || !Number.isFinite(rawCarriage.number)
    || !nonEmptyString(rawCarriage.label)
    || !nonEmptyString(rawCarriage.accentHex)
    || !nonEmptyString(rawCarriage.visualMark)
  ) {
    return null;
  }

  return {
    id: row.id,
    kind: 'guest_registered',
    createdAt: row.created_at,
    payload: {
      displayName: rawPayload.displayName.trim(),
      carriage: {
        id: rawCarriage.id,
        number: rawCarriage.number,
        label: rawCarriage.label,
        accentHex: rawCarriage.accentHex,
        visualMark: rawCarriage.visualMark,
      },
    },
  };
}

export function subscribeToScreenEvents(
  client: ScreenEventsRealtimeClient,
  eventSlug: string,
  onEvent: (event: GuestRegistrationScreenEvent) => void,
): () => void {
  const channel = client.channel(`screen-events:${eventSlug}`);

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
        const row = payload.new;
        if (!row) return;
        const event = parseGuestRegistrationEvent(row);
        if (event) onEvent(event);
      },
    )
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
