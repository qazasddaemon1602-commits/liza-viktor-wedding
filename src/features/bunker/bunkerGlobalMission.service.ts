import type { BunkerRpcClient, BunkerRpcError } from './bunker.service';

export const BUNKER_GLOBAL_MISSION_STATES = [
  'MISSION_01',
  'MISSION_02',
  'MISSION_03',
  'MISSION_04',
  'MISSION_05',
  'MISSION_06',
] as const;

export type BunkerGlobalMissionState = typeof BUNKER_GLOBAL_MISSION_STATES[number];

type BunkerM04Message = {
  message: string;
  partnerWagonIds?: string[];
};

export type BunkerM04MissionPayload = BunkerM04Message & (
  | { transferLotId?: never; transferToWagonId?: never }
  | { transferLotId: string; transferToWagonId: string }
);

export type BunkerGlobalMissionPayload =
  | { selectedProfileIds: string[] }
  | { chronology: string }
  | { itemKeys: string[] }
  | BunkerM04MissionPayload
  | { routeChoice: 'safe' | 'short'; itemKey?: string | null }
  | { protocolConfirmed: true; protocolCode: string };

export type GuestBunkerGlobalMissionSubmission = {
  status: 'completed';
  missionState: BunkerGlobalMissionState;
  carriageId: string;
  completedAt: string;
  changed: boolean;
  submittedPayload: Record<string, unknown>;
};

const MISSION_STATES = new Set<string>(BUNKER_GLOBAL_MISSION_STATES);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function isBunkerGlobalMissionState(value: unknown): value is BunkerGlobalMissionState {
  return typeof value === 'string' && MISSION_STATES.has(value);
}

export function parseGuestBunkerGlobalMissionSubmission(
  value: unknown,
): GuestBunkerGlobalMissionSubmission {
  if (!record(value)
    || value.status !== 'completed'
    || !isBunkerGlobalMissionState(value.missionState)
    || typeof value.carriageId !== 'string'
    || !value.carriageId.trim()
    || !timestamp(value.completedAt)
    || typeof value.changed !== 'boolean'
    || !record(value.submittedPayload)) {
    throw new Error('Unexpected Bunker global mission response');
  }
  return value as GuestBunkerGlobalMissionSubmission;
}

function throwRpc(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Bunker global mission request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function submitGuestBunkerGlobalMission(
  client: BunkerRpcClient,
  eventSlug: string,
  deviceKey: string,
  missionState: BunkerGlobalMissionState,
  payload: BunkerGlobalMissionPayload,
): Promise<GuestBunkerGlobalMissionSubmission> {
  if (missionState === 'MISSION_04') {
    const transferLot = 'transferLotId' in payload
      && typeof payload.transferLotId === 'string'
      && Boolean(payload.transferLotId.trim());
    const transferDestination = 'transferToWagonId' in payload
      && typeof payload.transferToWagonId === 'string'
      && Boolean(payload.transferToWagonId.trim());
    if (transferLot !== transferDestination) {
      throw new Error('Bunker M04 transfer lot and transfer destination must be provided together');
    }
  }
  const { data, error } = await client.rpc('submit_guest_bunker_global_mission', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_mission_state: missionState,
    p_payload: payload,
  });
  if (error) throwRpc(error);
  return parseGuestBunkerGlobalMissionSubmission(data);
}

export async function forceCompleteBunkerGlobalMission(
  client: BunkerRpcClient,
  eventId: string,
  carriageId: string,
  missionState: BunkerGlobalMissionState,
): Promise<GuestBunkerGlobalMissionSubmission> {
  const { data, error } = await client.rpc('owner_force_complete_bunker_global_mission', {
    p_event_id: eventId,
    p_carriage_id: carriageId,
    p_mission_state: missionState,
  });
  if (error) throwRpc(error);
  return parseGuestBunkerGlobalMissionSubmission(data);
}
