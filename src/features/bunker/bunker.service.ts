export type BunkerScreenState =
  | { status: 'idle' | 'not_found'; serverNow: string }
  | {
      status: 'active';
      startedAt: string;
      durationSeconds: number;
      remainingSeconds: number;
      soundEnabled: boolean;
      serverNow: string;
    };

export type OwnerBunkerControl =
  | {
      status: 'idle';
      durationSeconds: number;
      soundEnabled: boolean;
      serverNow: string;
    }
  | {
      status: 'active';
      startedAt: string;
      durationSeconds: number;
      remainingSeconds: number;
      soundEnabled: boolean;
      serverNow: string;
    };

export type BunkerRpcError = Error | { message?: string; code?: string } | null;
export type BunkerRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: BunkerRpcError }>;
};

function rpcError(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Bunker request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function date(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Unexpected bunker timestamp');
  }
  return value;
}

function positiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('Unexpected bunker duration');
  }
  return value;
}

function parseScreen(data: unknown): BunkerScreenState {
  if (!record(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected bunker screen response');
  }
  const serverNow = date(data.serverNow);
  if (data.status === 'idle' || data.status === 'not_found') {
    return { status: data.status, serverNow };
  }
  if (
    data.status !== 'active'
    || typeof data.startedAt !== 'string'
    || typeof data.soundEnabled !== 'boolean'
  ) {
    throw new Error('Unexpected bunker active response');
  }
  return {
    status: 'active',
    startedAt: date(data.startedAt),
    durationSeconds: positiveInteger(data.durationSeconds),
    remainingSeconds: positiveInteger(data.remainingSeconds),
    soundEnabled: data.soundEnabled,
    serverNow,
  };
}

function parseOwner(data: unknown): OwnerBunkerControl {
  const parsed = parseScreen(data);
  if (parsed.status === 'not_found') {
    throw new Error('Unexpected owner bunker response');
  }
  if (parsed.status === 'active') return parsed;
  if (!record(data) || typeof data.soundEnabled !== 'boolean') {
    throw new Error('Unexpected owner bunker idle response');
  }
  return {
    status: 'idle',
    durationSeconds: positiveInteger(data.durationSeconds),
    soundEnabled: data.soundEnabled,
    serverNow: parsed.serverNow,
  };
}

export async function getBunkerScreenState(
  client: BunkerRpcClient,
  eventSlug: string,
): Promise<BunkerScreenState> {
  const { data, error } = await client.rpc('get_bunker_screen_state', { p_event_slug: eventSlug });
  if (error) rpcError(error);
  return parseScreen(data);
}

export async function getOwnerBunkerControl(
  client: BunkerRpcClient,
  eventId: string,
): Promise<OwnerBunkerControl> {
  const { data, error } = await client.rpc('owner_get_bunker_control', { p_event_id: eventId });
  if (error) rpcError(error);
  return parseOwner(data);
}

async function command(client: BunkerRpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) rpcError(error);
  if (!record(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected bunker command response');
  }
  return data;
}

export async function startBunker(client: BunkerRpcClient, eventId: string, durationSeconds = 1800) {
  return command(client, 'owner_start_bunker', {
    p_event_id: eventId,
    p_duration_seconds: durationSeconds,
  });
}

export async function stopBunker(client: BunkerRpcClient, eventId: string) {
  return command(client, 'owner_stop_bunker', { p_event_id: eventId });
}

export async function setBunkerSound(client: BunkerRpcClient, eventId: string, enabled: boolean) {
  return command(client, 'owner_set_bunker_sound', { p_event_id: eventId, p_enabled: enabled });
}
