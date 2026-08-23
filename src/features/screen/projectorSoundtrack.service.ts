export type ProjectorSoundtrackRpcError = Error | { message?: string; code?: string } | null;

export type ProjectorSoundtrackRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: ProjectorSoundtrackRpcError }>;
};

export type ProjectorSoundtrackState = {
  status: 'ok';
  currentModule: string;
  screenMode: string;
  screenPinned: boolean;
  globalGameState: string | null;
  soundEnabled: boolean;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function throwRpcError(error: Exclude<ProjectorSoundtrackRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Projector soundtrack state request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function getProjectorSoundtrackState(
  client: ProjectorSoundtrackRpcClient,
  eventSlug: string,
): Promise<ProjectorSoundtrackState | null> {
  const { data, error } = await client.rpc('get_projector_soundtrack_state', {
    p_event_slug: eventSlug,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status === 'not_found') return null;
  if (
    data.status !== 'ok'
    || typeof data.currentModule !== 'string'
    || typeof data.screenMode !== 'string'
    || typeof data.screenPinned !== 'boolean'
    || (data.globalGameState !== null && typeof data.globalGameState !== 'string')
    || typeof data.soundEnabled !== 'boolean'
    || typeof data.updatedAt !== 'string'
  ) {
    throw new Error('Unexpected projector soundtrack state response');
  }
  return data as ProjectorSoundtrackState;
}
