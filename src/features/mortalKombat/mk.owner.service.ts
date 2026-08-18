import type { MkMatch, MkOwnerControl, MkOwnerRegistration, MkTournamentState } from './mk.types';

export type MkOwnerRpcError = Error | { message?: string; code?: string } | null;
export type MkOwnerRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: MkOwnerRpcError }>;
};

function throwRpcError(error: Exclude<MkOwnerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Owner Mortal Kombat request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRegistration(value: unknown): MkOwnerRegistration {
  if (!isRecord(value)
    || typeof value.registrationId !== 'string'
    || typeof value.guestId !== 'string'
    || typeof value.displayName !== 'string'
    || !['active', 'waitlist', 'withdrawn'].includes(String(value.status))
    || !(value.seed === null || typeof value.seed === 'number')
    || typeof value.registeredAt !== 'string') {
    throw new Error('Unexpected owner MK registration payload');
  }
  return value as unknown as MkOwnerRegistration;
}

function parseMatch(value: unknown): MkMatch {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.matchKey !== 'string'
    || !['r16', 'qf', 'sf', 'final'].includes(String(value.round))
    || typeof value.position !== 'number'
    || !['pending', 'ready', 'complete'].includes(String(value.status))
    || typeof value.current !== 'boolean') {
    throw new Error('Unexpected owner MK match payload');
  }
  return value as unknown as MkMatch;
}

export async function getOwnerMkControl(
  client: MkOwnerRpcClient,
  eventId: string,
): Promise<MkOwnerControl> {
  const { data, error } = await client.rpc('owner_get_mk_control', { p_event_id: eventId });
  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected owner MK control response');
  }
  if (data.status === 'idle') return { status: 'idle' };
  if (
    data.status !== 'owner'
    || typeof data.tournamentId !== 'string'
    || !['registration', 'draw_ready', 'active', 'complete'].includes(String(data.state))
    || typeof data.activeCount !== 'number'
    || typeof data.waitlistCount !== 'number'
    || data.maxPlayers !== 16
    || !Array.isArray(data.registrations)
    || !Array.isArray(data.matches)
  ) {
    throw new Error('Unexpected owner MK control payload');
  }
  return {
    status: 'owner',
    tournamentId: data.tournamentId,
    state: data.state as MkTournamentState,
    activeCount: data.activeCount,
    waitlistCount: data.waitlistCount,
    maxPlayers: 16,
    registrations: data.registrations.map(parseRegistration),
    matches: data.matches.map(parseMatch),
    championGuestId: typeof data.championGuestId === 'string' ? data.championGuestId : null,
  };
}

async function ownerCommand(
  client: MkOwnerRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwRpcError(error);
  return data;
}

export async function openMkRegistration(client: MkOwnerRpcClient, eventId: string): Promise<void> {
  await ownerCommand(client, 'owner_open_mk_registration', { p_event_id: eventId });
}

export async function closeMkRegistration(client: MkOwnerRpcClient, eventId: string): Promise<void> {
  await ownerCommand(client, 'owner_close_mk_registration', { p_event_id: eventId });
}

export async function randomizeMkSeeds(client: MkOwnerRpcClient, eventId: string): Promise<void> {
  await ownerCommand(client, 'owner_randomize_mk_seeds', { p_event_id: eventId });
}

export async function swapMkSeeds(
  client: MkOwnerRpcClient,
  registrationA: string,
  registrationB: string,
): Promise<void> {
  await ownerCommand(client, 'owner_swap_mk_seeds', {
    p_registration_a: registrationA,
    p_registration_b: registrationB,
  });
}

export async function replaceMkPlayer(
  client: MkOwnerRpcClient,
  registrationId: string,
  guestId: string,
): Promise<void> {
  await ownerCommand(client, 'owner_replace_mk_player', {
    p_registration_id: registrationId,
    p_guest_id: guestId,
  });
}

export async function removeMkPlayer(client: MkOwnerRpcClient, registrationId: string): Promise<void> {
  await ownerCommand(client, 'owner_remove_mk_player', { p_registration_id: registrationId });
}

export async function promoteMkWaitlist(client: MkOwnerRpcClient, registrationId: string): Promise<void> {
  await ownerCommand(client, 'owner_promote_mk_waitlist', { p_registration_id: registrationId });
}

export async function finalizeMkDraw(client: MkOwnerRpcClient, eventId: string): Promise<void> {
  await ownerCommand(client, 'owner_finalize_mk_draw', { p_event_id: eventId });
}
