import type { BunkerRpcClient, BunkerRpcError } from './bunker.service';
import {
  BUNKER_GLOBAL_GAME_STATES,
  parseBunkerCurrentMission,
  type BunkerCurrentMission,
  type BunkerGameMode,
  type BunkerGlobalGameState,
} from './bunkerSession.service';
import { parseBunkerContractState } from './bunkerSession.service';
import {
  parseBunkerV2GuestRuntime,
  type BunkerV2GuestRuntime,
} from './v2/contracts';
import {
  isBunkerGlobalMissionState,
  type BunkerGlobalMissionState,
} from './bunkerGlobalMission.service';

export type { BunkerCurrentMission } from './bunkerSession.service';

export type GuestBunkerGlobalMissionAction = {
  missionState: BunkerGlobalMissionState;
  completed: boolean;
  completedAt: string | null;
  submittedPayload: Record<string, unknown> | null;
  requirements: Record<string, unknown>;
};

export type GuestBunkerInventoryItem = {
  id: string;
  itemKey: string;
  quantity: number;
  status: 'available' | 'used' | 'transferred' | 'lost';
  acquiredAt?: string;
  usedAt?: string | null;
  transferredTo?: string | null;
  sourceLotId?: string | null;
};

export type GuestBunkerAbilityEffectKind =
  | 'power_stable'
  | 'technical_door_unlocked'
  | 'water_stable'
  | 'communication_boost'
  | 'route_hint'
  | 'sector_hint'
  | 'mission_clue';

export type GuestBunkerAbilityAction = {
  applicable: boolean;
  code: 'ability_available' | 'ability_not_applicable';
  missionState: BunkerGlobalGameState;
  effectKind: GuestBunkerAbilityEffectKind | null;
  effectLabel: string;
  effectDescription: string;
};

export type GuestBunkerAbilityResult = {
  status: 'used';
  changed: boolean;
  idempotent: boolean;
  clientActionId: string;
  missionState: BunkerGlobalGameState;
  abilityKey: string;
  effectKind: GuestBunkerAbilityEffectKind;
  effectLabel: string;
  effectDescription: string;
  resultCopy: string;
  abilityUsesRemaining: number;
};

type IdleRuntime = { status: 'idle' | 'not_found' | 'guest_not_found'; serverNow: string };

export type ActiveGuestBunkerRuntime = {
  status: 'active';
  serverNow: string;
  game: {
    runNonce: string; state: BunkerGlobalGameState; mode: BunkerGameMode;
    finalStartedAt: string | null; finalDuration: number; bunkerRevealed: boolean;
  };
  guest: { id: string; realName: string; joinedLate: boolean };
  wagon: { id: string; number: number; label: string };
  character: {
    profession: string; health: string; visibleSkill: string; hiddenTrait: string | null;
    hiddenTraitRevealed: boolean; specialAbility: string; abilityDescription: string;
    abilityUsesRemaining: number; status: 'active' | 'saved' | 'excluded';
    abilityAction?: GuestBunkerAbilityAction;
  };
  passengers: unknown[];
  inventory: GuestBunkerInventoryItem[];
  archive: unknown[];
  wagonState: Record<string, unknown>;
  currentMission: BunkerCurrentMission | null;
  missionAction?: GuestBunkerGlobalMissionAction | null;
};

export type GuestBunkerRuntime = IdleRuntime | ActiveGuestBunkerRuntime;
export type GuestBunkerReadRuntime = GuestBunkerRuntime | BunkerV2GuestRuntime;

const GAME_STATES = new Set<BunkerGlobalGameState>(BUNKER_GLOBAL_GAME_STATES);
const ABILITY_EFFECT_KINDS = new Set<GuestBunkerAbilityEffectKind>([
  'power_stable',
  'technical_door_unlocked',
  'water_stable',
  'communication_boost',
  'route_hint',
  'sector_hint',
  'mission_clue',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Unexpected Bunker ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Unexpected Bunker ${label}`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected Bunker ${label}`);
  }
  return value;
}

function flag(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected Bunker ${label}`);
  return value;
}

function timestamp(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Unexpected Bunker timestamp');
  }
  return value;
}

function missionAction(
  value: unknown,
  authoritativeState: BunkerGlobalGameState,
): GuestBunkerGlobalMissionAction | null {
  if (value === null || value === undefined) return null;
  const action = object(value, 'mission action');
  if (!isBunkerGlobalMissionState(action.missionState)
    || action.missionState !== authoritativeState
    || typeof action.completed !== 'boolean'
    || (action.completedAt !== null
      && (typeof action.completedAt !== 'string'
        || !Number.isFinite(Date.parse(action.completedAt))))
    || (action.completed && action.completedAt === null)
    || (!action.completed && action.completedAt !== null)
    || (action.submittedPayload !== null
      && (typeof action.submittedPayload !== 'object'
        || Array.isArray(action.submittedPayload)))
    || typeof action.requirements !== 'object'
    || action.requirements === null
    || Array.isArray(action.requirements)) {
    throw new Error('Unexpected Bunker mission action');
  }
  return action as GuestBunkerGlobalMissionAction;
}

function abilityAction(
  value: unknown,
  authoritativeState: BunkerGlobalGameState,
): GuestBunkerAbilityAction | undefined {
  if (value === undefined) return undefined;
  const action = object(value, 'ability action');
  const applicable = action.applicable;
  const code = action.code;
  const effectKind = action.effectKind;
  if (typeof applicable !== 'boolean'
    || (code !== 'ability_available' && code !== 'ability_not_applicable')
    || action.missionState !== authoritativeState
    || (applicable && (code !== 'ability_available'
      || typeof effectKind !== 'string'
      || !ABILITY_EFFECT_KINDS.has(effectKind as GuestBunkerAbilityEffectKind)))
    || (!applicable && (code !== 'ability_not_applicable' || effectKind !== null))) {
    throw new Error('Unexpected Bunker ability action');
  }
  return {
    applicable,
    code,
    missionState: authoritativeState,
    effectKind: effectKind as GuestBunkerAbilityEffectKind | null,
    effectLabel: text(action.effectLabel, 'ability action label'),
    effectDescription: text(action.effectDescription, 'ability action description'),
  };
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = integer(value, label);
  if (parsed < 1) throw new Error(`Unexpected Bunker ${label}`);
  return parsed;
}

function inventoryItem(value: unknown): GuestBunkerInventoryItem {
  const item = object(value, 'inventory item');
  const status = item.status;
  const usedAt = timestamp(item.usedAt, true);
  const transferredTo = item.transferredTo;
  const sourceLotId = item.sourceLotId;
  if (status !== 'available' && status !== 'used' && status !== 'transferred' && status !== 'lost') {
    throw new Error('Unexpected Bunker inventory item status');
  }
  if ((status === 'used') !== (usedAt !== null)
    || (status === 'transferred') !== (typeof transferredTo === 'string' && Boolean(transferredTo.trim()))
    || (status !== 'transferred' && transferredTo !== null)
    || (sourceLotId !== undefined && sourceLotId !== null
      && (typeof sourceLotId !== 'string' || !sourceLotId.trim()))) {
    throw new Error('Unexpected Bunker inventory item state');
  }
  return {
    id: text(item.id, 'inventory item id'),
    itemKey: text(item.itemKey, 'inventory item key'),
    quantity: positiveInteger(item.quantity, 'inventory item quantity'),
    status,
    acquiredAt: timestamp(item.acquiredAt) as string,
    usedAt,
    transferredTo: transferredTo as string | null,
    ...(sourceLotId === undefined ? {} : { sourceLotId: sourceLotId as string | null }),
  };
}

export function parseGuestBunkerRuntime(data: unknown): GuestBunkerRuntime {
  const root = object(data, 'runtime');
  const status = root.status;
  const serverNow = timestamp(root.serverNow) as string;
  if (status === 'idle' || status === 'not_found' || status === 'guest_not_found') {
    return { status, serverNow };
  }
  if (status !== 'active') throw new Error('Unexpected Bunker runtime status');

  const game = object(root.game, 'game state');
  const guest = object(root.guest, 'guest');
  const wagon = object(root.wagon, 'wagon');
  const character = object(root.character, 'character');
  const hiddenTraitRevealed = flag(character.hiddenTraitRevealed, 'hidden trait flag');
  if ((!hiddenTraitRevealed && character.hiddenTrait !== null)
    || (hiddenTraitRevealed && typeof character.hiddenTrait !== 'string')) {
    throw new Error('Unexpected Bunker hidden trait visibility');
  }
  if (!GAME_STATES.has(game.state as BunkerGlobalGameState)) {
    throw new Error('Unexpected Bunker global game state');
  }
  if (game.mode !== 'production' && game.mode !== 'test') throw new Error('Unexpected Bunker game mode');
  if (!Array.isArray(root.passengers) || !Array.isArray(root.inventory) || !Array.isArray(root.archive)) {
    throw new Error('Unexpected Bunker runtime collections');
  }
  const characterStatus = character.status;
  if (characterStatus !== 'active' && characterStatus !== 'saved' && characterStatus !== 'excluded') {
    throw new Error('Unexpected Bunker character status');
  }

  return {
    status: 'active', serverNow,
    game: {
      runNonce: text(game.runNonce, 'run nonce'),
      state: game.state as BunkerGlobalGameState,
      mode: game.mode,
      finalStartedAt: timestamp(game.finalStartedAt, true),
      finalDuration: integer(game.finalDuration, 'final duration'),
      bunkerRevealed: flag(game.bunkerRevealed, 'Bunker reveal flag'),
    },
    guest: {
      id: text(guest.id, 'guest id'), realName: text(guest.realName, 'real name'),
      joinedLate: flag(guest.joinedLate, 'late registration flag'),
    },
    wagon: {
      id: text(wagon.id, 'wagon id'), number: integer(wagon.number, 'wagon number'),
      label: text(wagon.label, 'wagon label'),
    },
    character: {
      profession: text(character.profession, 'profession'), health: text(character.health, 'health'),
      visibleSkill: text(character.visibleSkill, 'visible skill'),
      hiddenTrait: character.hiddenTrait as string | null, hiddenTraitRevealed,
      specialAbility: text(character.specialAbility, 'special ability'),
      abilityDescription: text(character.abilityDescription, 'ability description'),
      abilityUsesRemaining: integer(character.abilityUsesRemaining, 'ability uses'),
      status: characterStatus,
      abilityAction: abilityAction(character.abilityAction, game.state as BunkerGlobalGameState),
    },
    passengers: root.passengers,
    inventory: root.inventory.map(inventoryItem),
    archive: root.archive,
    wagonState: object(root.wagonState, 'wagon state'),
    currentMission: parseBunkerCurrentMission(
      root.currentMission,
      game.state as BunkerGlobalGameState,
    ),
    missionAction: missionAction(root.missionAction, game.state as BunkerGlobalGameState),
  };
}

function responseContractVersion(data: unknown): 1 | 2 {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Unexpected Bunker runtime contract version');
  }
  const version = (data as Record<string, unknown>).contractVersion;
  if (version === undefined || version === 1) return 1;
  if (version === 2) return 2;
  throw new Error('Unexpected Bunker runtime contract version');
}

export function parseGuestBunkerReadRuntime(data: unknown): GuestBunkerReadRuntime {
  const contractVersion = responseContractVersion(data);
  if (contractVersion === 2) {
    const runtime = parseBunkerV2GuestRuntime(data);
    if (runtime.status === 'active') {
      parseBunkerContractState({ contractVersion, state: runtime.state });
    }
    return runtime;
  }

  const runtime = parseGuestBunkerRuntime(data);
  if (runtime.status === 'active') {
    parseBunkerContractState({ contractVersion, state: runtime.game.state });
  }
  return runtime;
}

export function isLegacyActiveGuestBunkerRuntime(
  runtime: GuestBunkerReadRuntime,
): runtime is ActiveGuestBunkerRuntime {
  return runtime.status === 'active' && !('contractVersion' in runtime);
}

function throwRpc(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || 'Bunker runtime request failed');
}

export async function getGuestBunkerRuntime(
  client: BunkerRpcClient, eventSlug: string, deviceKey: string,
): Promise<GuestBunkerReadRuntime> {
  const { data, error } = await client.rpc('get_guest_bunker_runtime', {
    p_event_slug: eventSlug, p_device_key: deviceKey,
  });
  if (error) throwRpc(error);
  return parseGuestBunkerReadRuntime(data);
}

export function parseGuestBunkerAbilityResult(data: unknown): GuestBunkerAbilityResult {
  const result = object(data, 'ability result');
  if (result.status !== 'used'
    || typeof result.changed !== 'boolean'
    || typeof result.idempotent !== 'boolean'
    || result.changed === result.idempotent
    || typeof result.clientActionId !== 'string'
    || !UUID.test(result.clientActionId)
    || !GAME_STATES.has(result.missionState as BunkerGlobalGameState)
    || typeof result.effectKind !== 'string'
    || !ABILITY_EFFECT_KINDS.has(result.effectKind as GuestBunkerAbilityEffectKind)) {
    throw new Error('Unexpected Bunker ability result');
  }
  return {
    status: 'used',
    changed: result.changed,
    idempotent: result.idempotent,
    clientActionId: result.clientActionId,
    missionState: result.missionState as BunkerGlobalGameState,
    abilityKey: text(result.abilityKey, 'ability result key'),
    effectKind: result.effectKind as GuestBunkerAbilityEffectKind,
    effectLabel: text(result.effectLabel, 'ability result label'),
    effectDescription: text(result.effectDescription, 'ability result description'),
    resultCopy: text(result.resultCopy, 'ability result copy'),
    abilityUsesRemaining: integer(result.abilityUsesRemaining, 'ability result uses'),
  };
}

export async function useGuestBunkerAbility(
  client: BunkerRpcClient,
  eventSlug: string,
  deviceKey: string,
  clientActionId: string,
): Promise<GuestBunkerAbilityResult> {
  if (!UUID.test(clientActionId)) throw new Error('Invalid Bunker ability action id');
  const { data, error } = await client.rpc('use_guest_bunker_ability', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_client_action_id: clientActionId,
  });
  if (error) throwRpc(error);
  return parseGuestBunkerAbilityResult(data);
}
