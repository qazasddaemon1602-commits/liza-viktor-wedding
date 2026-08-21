import type { BunkerPhase } from './bunkerQuest.types';
import {
  BUNKER_GLOBAL_GAME_STATES,
  parseBunkerCurrentMission,
  type BunkerCurrentMission,
  type BunkerGlobalGameState,
} from './bunkerSession.service';

export type BunkerScreenTeamState = {
  carriageNumber: number;
  label: string;
  missionAComplete: boolean;
  missionBComplete: boolean;
};

export type BunkerScreenCharacterCounts = {
  active: number;
  saved: number;
  excluded: number;
};

export type BunkerScreenState =
  | { status: 'idle' | 'not_found'; serverNow: string }
  | {
      status: 'active';
      contractVersion?: 1 | 2;
      startedAt: string;
      durationSeconds: number;
      remainingSeconds: number;
      soundEnabled: boolean;
      phase: BunkerPhase;
      unlocked: boolean;
      teams: BunkerScreenTeamState[];
      characterCounts: BunkerScreenCharacterCounts;
      globalGameState?: BunkerGlobalGameState;
      currentMission?: BunkerCurrentMission | null;
      serverNow: string;
    };

export type OwnerBunkerControl =
  | {
      status: 'idle';
      durationSeconds: number;
      soundEnabled: boolean;
      runNonce?: string;
      globalGameState?: BunkerGlobalGameState;
      currentMission?: BunkerCurrentMission | null;
      serverNow: string;
    }
  | {
      status: 'active';
      startedAt: string;
      durationSeconds: number;
      remainingSeconds: number;
      soundEnabled: boolean;
      runNonce?: string;
      globalGameState?: BunkerGlobalGameState;
      currentMission?: BunkerCurrentMission | null;
      serverNow: string;
    };

export type BunkerRpcError = Error | { message?: string; code?: string } | null;
export type BunkerRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: BunkerRpcError }>;
};

const BUNKER_PHASES = new Set<BunkerPhase>([
  'emergency',
  'dossier_1',
  'dossier_2',
  'mission_a',
  'mission_b',
  'final',
  'completed',
]);
const GLOBAL_GAME_STATES = new Set<BunkerGlobalGameState>(BUNKER_GLOBAL_GAME_STATES);

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

function phase(value: unknown): BunkerPhase {
  if (value === undefined) return 'emergency';
  if (typeof value !== 'string' || !BUNKER_PHASES.has(value as BunkerPhase)) {
    throw new Error('Unexpected bunker phase');
  }
  return value as BunkerPhase;
}

function parseTeams(value: unknown): BunkerScreenTeamState[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Unexpected bunker team progress');
  return value.map((entry) => {
    if (
      !record(entry)
      || typeof entry.carriageNumber !== 'number'
      || !Number.isInteger(entry.carriageNumber)
      || entry.carriageNumber < 1
      || typeof entry.label !== 'string'
      || !entry.label.trim()
      || typeof entry.missionAComplete !== 'boolean'
      || typeof entry.missionBComplete !== 'boolean'
    ) {
      throw new Error('Unexpected bunker team progress');
    }
    return {
      carriageNumber: entry.carriageNumber,
      label: entry.label,
      missionAComplete: entry.missionAComplete,
      missionBComplete: entry.missionBComplete,
    };
  });
}

function parseCharacterCounts(value: unknown): BunkerScreenCharacterCounts {
  if (value === undefined) return { active: 0, saved: 0, excluded: 0 };
  if (!record(value)) throw new Error('Unexpected bunker character counts');
  const active = positiveInteger(value.active);
  const saved = positiveInteger(value.saved);
  const excluded = positiveInteger(value.excluded);
  return { active, saved, excluded };
}

function authoritativeState(data: Record<string, unknown>): {
  globalGameState?: BunkerGlobalGameState;
  currentMission?: BunkerCurrentMission | null;
} {
  if (data.globalGameState === undefined) return {};
  if (
    typeof data.globalGameState !== 'string'
    || !GLOBAL_GAME_STATES.has(data.globalGameState as BunkerGlobalGameState)
  ) {
    throw new Error('Unexpected bunker global game state');
  }
  const globalGameState = data.globalGameState as BunkerGlobalGameState;
  return {
    globalGameState,
    currentMission: parseBunkerCurrentMission(data.currentMission, globalGameState),
  };
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
    ...(data.contractVersion === 1 || data.contractVersion === 2
      ? { contractVersion: data.contractVersion }
      : {}),
    startedAt: date(data.startedAt),
    durationSeconds: positiveInteger(data.durationSeconds),
    remainingSeconds: positiveInteger(data.remainingSeconds),
    soundEnabled: data.soundEnabled,
    phase: phase(data.phase),
    unlocked: data.unlocked === undefined ? false : Boolean(data.unlocked),
    teams: parseTeams(data.teams),
    characterCounts: parseCharacterCounts(data.characterCounts),
    ...authoritativeState(data),
    serverNow,
  };
}

function parseOwner(data: unknown): OwnerBunkerControl {
  const parsed = parseScreen(data);
  if (!record(data)) throw new Error('Unexpected owner bunker response');
  if (parsed.status === 'not_found') {
    throw new Error('Unexpected owner bunker response');
  }
  if (parsed.status === 'active') {
    return {
      ...parsed,
      ...(typeof data.runNonce === 'string'
        ? { runNonce: data.runNonce }
        : {}),
    };
  }
  if (!record(data) || typeof data.soundEnabled !== 'boolean') {
    throw new Error('Unexpected owner bunker idle response');
  }
  return {
    status: 'idle',
    durationSeconds: positiveInteger(data.durationSeconds),
    soundEnabled: data.soundEnabled,
    ...authoritativeState(data),
    ...(typeof data.runNonce === 'string' ? { runNonce: data.runNonce } : {}),
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

