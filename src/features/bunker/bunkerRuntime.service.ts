import type { BunkerRpcClient, BunkerRpcError } from './bunker.service';
import {
  BUNKER_GLOBAL_GAME_STATES,
  parseBunkerCurrentMission,
  type BunkerCurrentMission,
  type BunkerGameMode,
  type BunkerGlobalGameState,
} from './bunkerSession.service';
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
  };
  passengers: unknown[];
  inventory: unknown[];
  archive: unknown[];
  wagonState: Record<string, unknown>;
  currentMission: BunkerCurrentMission | null;
  missionAction?: GuestBunkerGlobalMissionAction | null;
};

export type GuestBunkerRuntime = IdleRuntime | ActiveGuestBunkerRuntime;

const GAME_STATES = new Set<BunkerGlobalGameState>(BUNKER_GLOBAL_GAME_STATES);

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
    },
    passengers: root.passengers,
    inventory: root.inventory,
    archive: root.archive,
    wagonState: object(root.wagonState, 'wagon state'),
    currentMission: parseBunkerCurrentMission(
      root.currentMission,
      game.state as BunkerGlobalGameState,
    ),
    missionAction: missionAction(root.missionAction, game.state as BunkerGlobalGameState),
  };
}

function throwRpc(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || 'Bunker runtime request failed');
}

export async function getGuestBunkerRuntime(
  client: BunkerRpcClient, eventSlug: string, deviceKey: string,
): Promise<GuestBunkerRuntime> {
  const { data, error } = await client.rpc('get_guest_bunker_runtime', {
    p_event_slug: eventSlug, p_device_key: deviceKey,
  });
  if (error) throwRpc(error);
  return parseGuestBunkerRuntime(data);
}
