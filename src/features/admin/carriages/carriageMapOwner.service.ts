type OwnerCarriageMapRpcError = Error | { message?: string } | null;

export type OwnerCarriageMapRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: OwnerCarriageMapRpcError;
  }>;
};

export async function publishRegistrationCarriageMap(
  client: OwnerCarriageMapRpcClient,
  eventId: string,
): Promise<void> {
  const { error } = await client.rpc('owner_publish_registration_carriage_map', {
    p_event_id: eventId,
  });
  if (error) throw error instanceof Error ? error : new Error(error.message ?? 'Unable to publish carriage map');
}
