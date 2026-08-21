import {
  parseBunkerCommand,
  parseBunkerCommandReceipt,
  type BunkerCommand,
  type BunkerCommandReceipt,
} from './contracts';

export type BunkerV2RpcError = Error | { message?: string; code?: string } | null;

export type BunkerV2RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: BunkerV2RpcError }>;
};

export function throwBunkerV2RpcError(
  error: Exclude<BunkerV2RpcError, null>,
  fallback: string,
): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || fallback);
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function submitBunkerCommand(
  client: BunkerV2RpcClient,
  eventSlug: string,
  deviceKey: string,
  commandId: string,
  command: BunkerCommand,
): Promise<BunkerCommandReceipt> {
  const parsed = parseBunkerCommand(command);
  const { data, error } = await client.rpc('submit_bunker_command', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_command_id: commandId,
    p_command_type: parsed.type,
    p_payload: parsed.payload,
  });
  if (error) throwBunkerV2RpcError(error, 'Bunker V2 command failed');
  return parseBunkerCommandReceipt(data);
}
