import {
  parseBunkerV2GuestRuntime,
  parseBunkerV2OwnerRuntime,
  type BunkerV2GuestRuntime,
  type BunkerV2OwnerRuntime,
} from './contracts';
import {
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';

export type BunkerV2RuntimeRpcClient = BunkerV2RpcClient;

async function runtimeRpc<T>(
  client: BunkerV2RuntimeRpcClient,
  name: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwBunkerV2RpcError(error, 'Bunker V2 runtime request failed');
  return parse(data);
}

export async function getGuestBunkerV2Runtime(
  client: BunkerV2RuntimeRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<BunkerV2GuestRuntime> {
  return runtimeRpc(client, 'get_guest_bunker_v2_runtime', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  }, parseBunkerV2GuestRuntime);
}

export async function getOwnerBunkerV2Runtime(
  client: BunkerV2RuntimeRpcClient,
  eventId: string,
): Promise<BunkerV2OwnerRuntime> {
  return runtimeRpc(
    client,
    'get_owner_bunker_v2_runtime',
    { p_event_id: eventId },
    parseBunkerV2OwnerRuntime,
  );
}
