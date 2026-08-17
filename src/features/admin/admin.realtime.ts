export type AdminRealtimePayload = {
  new?: { id?: unknown };
};

export type AdminRealtimeChannel = {
  on: (
    eventType: 'postgres_changes',
    filter: {
      event: 'INSERT';
      schema: 'public';
      table: 'guests';
      filter: string;
    },
    callback: (payload: AdminRealtimePayload) => void,
  ) => AdminRealtimeChannel;
  subscribe: () => unknown;
  unsubscribe: () => unknown;
};

export type AdminRealtimeClient = {
  channel: (name: string) => AdminRealtimeChannel;
};

export function subscribeToGuestRegistrations(
  client: AdminRealtimeClient,
  eventId: string,
  onRegistration: (guestId: string) => void,
): () => void {
  const channel = client.channel(`owner-guest-registration:${eventId}`);
  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'guests',
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        const guestId = payload.new?.id;
        if (typeof guestId === 'string' && guestId) onRegistration(guestId);
      },
    )
    .subscribe();

  return () => {
    void channel.unsubscribe();
  };
}
