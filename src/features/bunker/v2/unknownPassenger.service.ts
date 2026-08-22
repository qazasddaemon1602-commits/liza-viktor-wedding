import { throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';

export type UnknownPassengerRpcClient = BunkerV2RpcClient;
export type UnknownPassengerGuestReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active';
      serverNow: string;
      deadlineAt: string;
      title: string;
      dossierId: string;
      lead: string;
      sector: string;
      accessCode: string;
      bunkerRevealed: boolean;
      recoveredBy: 'common_protocol' | 'archive_recovery';
      storyPoints: string[];
    };
export type UnknownPassengerScreenReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active';
      serverNow: string;
      deadlineAt: string;
      title: string;
      dossierId: string;
      sector: string;
    };
export type UnknownPassengerOwnerReadModel = UnknownPassengerScreenReadModel;

function obj(value: unknown, label = 'read model'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected unknown passenger ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected unknown passenger ${label}`);
  }
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected unknown passenger ${label}`);
  return value;
}

function time(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected unknown passenger timestamp');
  return result;
}

export function parseUnknownPassengerGuestReadModel(value: unknown): UnknownPassengerGuestReadModel {
  const row = obj(value);
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected unknown passenger read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (
    row.status !== 'active'
    || !Array.isArray(row.storyPoints)
    || (row.recoveredBy !== 'common_protocol' && row.recoveredBy !== 'archive_recovery')
  ) {
    throw new Error('Unexpected unknown passenger active model');
  }
  return {
    contractVersion: 2,
    status: 'active',
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    title: text(row.title, 'title'),
    dossierId: text(row.dossierId, 'dossier'),
    lead: text(row.lead, 'lead'),
    sector: text(row.sector, 'sector'),
    accessCode: text(row.accessCode, 'access code'),
    bunkerRevealed: bool(row.bunkerRevealed, 'bunker revealed'),
    recoveredBy: row.recoveredBy,
    storyPoints: row.storyPoints.map((entry) => text(entry, 'story point')),
  };
}

export function parseUnknownPassengerScreenReadModel(value: unknown): UnknownPassengerScreenReadModel {
  const row = obj(value, 'screen read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected unknown passenger screen read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active') throw new Error('Unexpected unknown passenger screen status');
  return {
    contractVersion: 2,
    status: 'active',
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    title: text(row.title, 'title'),
    dossierId: text(row.dossierId, 'dossier'),
    sector: text(row.sector, 'sector'),
  };
}

export async function getGuestUnknownPassengerReadModel(
  client: UnknownPassengerRpcClient,
  eventSlug: string,
  deviceKey: string,
) {
  const { data, error } = await client.rpc('get_guest_bunker_v2_unknown_passenger', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Unknown passenger read failed');
  return parseUnknownPassengerGuestReadModel(data);
}

export async function getUnknownPassengerScreenReadModel(
  client: UnknownPassengerRpcClient,
  eventSlug: string,
) {
  const { data, error } = await client.rpc('get_bunker_v2_unknown_passenger_screen', {
    p_event_slug: eventSlug,
  });
  if (error) throwBunkerV2RpcError(error, 'Unknown passenger screen failed');
  return parseUnknownPassengerScreenReadModel(data);
}

export async function getOwnerUnknownPassengerReadModel(
  client: UnknownPassengerRpcClient,
  eventId: string,
) {
  const { data, error } = await client.rpc('get_owner_bunker_v2_unknown_passenger', {
    p_event_id: eventId,
  });
  if (error) throwBunkerV2RpcError(error, 'Unknown passenger owner failed');
  return parseUnknownPassengerScreenReadModel(data);
}
