import type { BunkerRpcClient, BunkerRpcError } from './bunker.service';

export type BunkerGameMode = 'production' | 'test';
export type BunkerGlobalGameState =
  | 'LOBBY'
  | 'CHARACTERS_READY'
  | 'MISSION_01'
  | 'BREAK'
  | 'MISSION_02'
  | 'MISSION_03'
  | 'MISSION_04'
  | 'MISSION_05'
  | 'MISSION_06'
  | 'STORY_BUNKER'
  | 'BREAK_BEFORE_FINAL'
  | 'FINAL_30'
  | 'BUNKER_OPEN'
  | 'FINISHED';

export type PreparedBunkerGame = {
  status: 'prepared';
  eventId: string;
  runNonce: string;
  globalGameState: 'LOBBY' | 'CHARACTERS_READY';
  gameMode: BunkerGameMode;
  wagonCount: number;
  guestCount: number;
};

export type DistributedBunkerCharacters = {
  status: 'characters_ready';
  runNonce: string;
  globalGameState: 'CHARACTERS_READY';
  assignedCount: number;
  wagonCount: number;
};

export type BunkerMissionPlan = Record<string, unknown> | unknown[] | null;

export type BunkerCurrentMission = {
  id: string;
  state: BunkerGlobalGameState;
  plan: BunkerMissionPlan;
};

export type AdvancedBunkerGameState = {
  status: 'transitioned';
  runNonce: string;
  previousState: BunkerGlobalGameState;
  globalGameState: BunkerGlobalGameState;
  changed: boolean;
  currentMission: BunkerCurrentMission | null;
};

export const BUNKER_GLOBAL_GAME_STATES: readonly BunkerGlobalGameState[] = [
  'LOBBY', 'CHARACTERS_READY', 'MISSION_01', 'BREAK', 'MISSION_02', 'MISSION_03',
  'MISSION_04', 'MISSION_05', 'MISSION_06', 'STORY_BUNKER', 'BREAK_BEFORE_FINAL',
  'FINAL_30', 'BUNKER_OPEN', 'FINISHED',
];

const GAME_STATES = new Set<BunkerGlobalGameState>(BUNKER_GLOBAL_GAME_STATES);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validWagonCount(value: unknown): value is number {
  return nonNegativeInteger(value) && value >= 2 && value <= 5;
}

function gameState(value: unknown): BunkerGlobalGameState {
  if (typeof value !== 'string' || !GAME_STATES.has(value as BunkerGlobalGameState)) {
    throw new Error('Unexpected Bunker game state');
  }
  return value as BunkerGlobalGameState;
}

function missionPlan(value: unknown): BunkerMissionPlan {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') throw new Error('Unexpected Bunker mission plan');
  return value as Record<string, unknown> | unknown[];
}

export function parseBunkerCurrentMission(
  value: unknown,
  authoritativeState: BunkerGlobalGameState,
): BunkerCurrentMission | null {
  if (value === null || value === undefined) return null;
  if (!record(value) || typeof value.id !== 'string' || !value.id.trim()) {
    throw new Error('Unexpected Bunker current mission');
  }
  const state = gameState(value.state);
  if (state !== authoritativeState) throw new Error('Unexpected Bunker mission state');
  return { id: value.id, state, plan: missionPlan(value.plan) };
}

function throwRpc(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Bunker session request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

async function rpc(
  client: BunkerRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwRpc(error);
  return data;
}

function parsePrepared(data: unknown): PreparedBunkerGame {
  if (!record(data)
    || data.status !== 'prepared'
    || typeof data.eventId !== 'string'
    || !UUID.test(data.eventId) && data.eventId !== 'event-1'
    || typeof data.runNonce !== 'string'
    || !UUID.test(data.runNonce)
    || (data.globalGameState !== 'LOBBY' && data.globalGameState !== 'CHARACTERS_READY')
    || (data.gameMode !== 'production' && data.gameMode !== 'test')
    || !validWagonCount(data.wagonCount)
    || !nonNegativeInteger(data.guestCount)) {
    throw new Error('Unexpected Bunker session preparation response');
  }
  return data as PreparedBunkerGame;
}

function parseDistributed(data: unknown): DistributedBunkerCharacters {
  if (!record(data)
    || data.status !== 'characters_ready'
    || typeof data.runNonce !== 'string'
    || !UUID.test(data.runNonce)
    || data.globalGameState !== 'CHARACTERS_READY'
    || !nonNegativeInteger(data.assignedCount)
    || !validWagonCount(data.wagonCount)) {
    throw new Error('Unexpected Bunker session character response');
  }
  return data as DistributedBunkerCharacters;
}

function parseAdvanced(data: unknown): AdvancedBunkerGameState {
  if (!record(data)
    || data.status !== 'transitioned'
    || typeof data.runNonce !== 'string'
    || !UUID.test(data.runNonce)
    || typeof data.changed !== 'boolean') {
    throw new Error('Unexpected Bunker state transition response');
  }
  const previousState = gameState(data.previousState);
  const globalGameState = gameState(data.globalGameState);
  try {
    return {
      status: 'transitioned',
      runNonce: data.runNonce,
      previousState,
      globalGameState,
      changed: data.changed,
      currentMission: parseBunkerCurrentMission(data.currentMission, globalGameState),
    };
  } catch {
    throw new Error('Unexpected Bunker state transition response');
  }
}

export async function prepareBunkerGame(
  client: BunkerRpcClient,
  eventId: string,
  gameMode: BunkerGameMode,
): Promise<PreparedBunkerGame> {
  return parsePrepared(await rpc(client, 'owner_prepare_bunker_game', {
    p_event_id: eventId,
    p_game_mode: gameMode,
  }));
}

export async function distributeBunkerCharacters(
  client: BunkerRpcClient,
  eventId: string,
): Promise<DistributedBunkerCharacters> {
  return parseDistributed(await rpc(client, 'owner_distribute_bunker_characters', {
    p_event_id: eventId,
  }));
}

export async function advanceBunkerGameState(
  client: BunkerRpcClient,
  eventId: string,
  nextState: BunkerGlobalGameState,
): Promise<AdvancedBunkerGameState> {
  return parseAdvanced(await rpc(client, 'owner_advance_bunker_game_state', {
    p_event_id: eventId,
    p_next_state: nextState,
  }));
}
