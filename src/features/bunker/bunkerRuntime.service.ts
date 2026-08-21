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

export type { BunkerCurrentMission } from './bunkerSession.service';

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
};

export type GuestBunkerRuntime = IdleRuntime | ActiveGuestBunkerRuntime;
export type GuestBunkerReadRuntime = GuestBunkerRuntime | BunkerV2GuestRuntime;

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
