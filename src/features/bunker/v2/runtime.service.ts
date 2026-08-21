import { parseBunkerV2Runtime, type BunkerV2Runtime } from './contracts';
import {
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';

export type BunkerV2RuntimeRpcClient = BunkerV2RpcClient;

async function runtimeRpc(
  client: BunkerV2RuntimeRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<BunkerV2Runtime> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwBunkerV2RpcError(error, 'Bunker V2 runtime request failed');
  return parseBunkerV2Runtime(data);
}

export async function getGuestBunkerV2Runtime(
  client: BunkerV2RuntimeRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<BunkerV2Runtime> {
  return runtimeRpc(client, 'get_guest_bunker_v2_runtime', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
}

export async function getOwnerBunkerV2Runtime(
  client: BunkerV2RuntimeRpcClient,
  eventId: string,
): Promise<BunkerV2Runtime> {
  return runtimeRpc(client, 'get_owner_bunker_v2_runtime', { p_event_id: eventId });
}
