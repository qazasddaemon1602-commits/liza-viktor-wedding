import type { MkJoinResult, MkMatch, MkPlayer, MkRegistrationStatus, MkTournamentProjection, MkTournamentState } from './mk.types';

export type MkRpcError = Error | { message?: string; code?: string } | null;
export type MkRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: MkRpcError }>;
};

function throwRpcError(error: Exclude<MkRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Mortal Kombat request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const tournamentStates = new Set<MkTournamentState>(['registration', 'draw_ready', 'active', 'complete']);
const registrationStates = new Set<MkRegistrationStatus>(['active', 'waitlist', 'withdrawn']);

function parsePlayer(value: unknown): MkPlayer {
  if (!isRecord(value)
    || typeof value.registrationId !== 'string'
    || typeof value.guestId !== 'string'
    || typeof value.displayName !== 'string'
    || !(value.seed === null || typeof value.seed === 'number')) {
    throw new Error('Unexpected MK player payload');
  }
  return value as unknown as MkPlayer;
}

function parseMatch(value: unknown): MkMatch {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.matchKey !== 'string'
    || !['r16', 'qf', 'sf', 'final'].includes(String(value.round))
    || typeof value.position !== 'number'
    || !['pending', 'ready', 'complete'].includes(String(value.status))
    || typeof value.current !== 'boolean') {
    throw new Error('Unexpected MK match payload');
  }
  return value as unknown as MkMatch;
}

function parseTournament(data: unknown): MkTournamentProjection {
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected MK tournament response');
  }
  if (data.status === 'idle' || data.status === 'not_found') {
    return { status: data.status };
  }
  if (
    data.status !== 'active'
    || typeof data.tournamentId !== 'string'
    || !tournamentStates.has(data.state as MkTournamentState)
    || typeof data.activeCount !== 'number'
    || data.maxPlayers !== 16
    || !Array.isArray(data.players)
    || !Array.isArray(data.matches)
  ) {
    throw new Error('Unexpected MK tournament payload');
  }

  const ownStatus = data.ownRegistrationStatus;
  if (!(ownStatus === null || ownStatus === undefined || registrationStates.has(ownStatus as MkRegistrationStatus))) {
    throw new Error('Unexpected MK registration status');
  }

  return {
    status: 'active',
    tournamentId: data.tournamentId,
    state: data.state as MkTournamentState,
    activeCount: data.activeCount,
    maxPlayers: 16,
    ownRegistrationStatus: (ownStatus ?? null) as MkRegistrationStatus | null,
    waitlistPosition: typeof data.waitlistPosition === 'number' ? data.waitlistPosition : null,
    players: data.players.map(parsePlayer),
    matches: data.matches.map(parseMatch),
    championGuestId: typeof data.championGuestId === 'string' ? data.championGuestId : null,
  };
}

function parseJoin(data: unknown): MkJoinResult {
  if (!isRecord(data)
    || !['joined', 'already_joined'].includes(String(data.status))
    || !['active', 'waitlist'].includes(String(data.registrationStatus))
    || typeof data.activeCount !== 'number'
    || data.maxPlayers !== 16) {
    throw new Error('Unexpected MK signup response');
  }
  return {
    status: data.status as MkJoinResult['status'],
    registrationStatus: data.registrationStatus as MkJoinResult['registrationStatus'],
    activeCount: data.activeCount,
    maxPlayers: 16,
    waitlistPosition: typeof data.waitlistPosition === 'number' ? data.waitlistPosition : null,
  };
}

async function loadMkProjection(
  client: MkRpcClient,
  eventSlug: string,
  deviceKey: string | null,
): Promise<MkTournamentProjection> {
  const { data, error } = await client.rpc('get_mk_tournament_state', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwRpcError(error);
  return parseTournament(data);
}

export async function getMkTournamentState(
  client: MkRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<MkTournamentProjection> {
  return loadMkProjection(client, eventSlug, deviceKey);
}

export async function getMkTournamentScreenState(
  client: MkRpcClient,
  eventSlug: string,
): Promise<MkTournamentProjection> {
  return loadMkProjection(client, eventSlug, null);
}

export async function joinMkTournament(
  client: MkRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<MkJoinResult> {
  const { data, error } = await client.rpc('join_mk_tournament', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwRpcError(error);
  return parseJoin(data);
}
