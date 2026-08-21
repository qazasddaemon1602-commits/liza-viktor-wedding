import type { BunkerRpcClient, BunkerRpcError } from './bunker.service';

export type BunkerCharacterStatus = 'active' | 'saved' | 'excluded';

export type OwnerBunkerCharacter = {
  guestId: string;
  realName: string;
  wagon: { id: string; number: number; label: string };
  profession: string;
  characterStatus: BunkerCharacterStatus;
  joinedLate: boolean;
};

export type OwnerBunkerCharacters =
  | { status: 'idle'; characters: []; serverNow: string }
  | {
      status: 'active';
      runNonce: string;
      characters: OwnerBunkerCharacter[];
      serverNow: string;
    };

export type UpdatedBunkerCharacterStatus = {
  status: 'updated';
  guestId: string;
  characterStatus: BunkerCharacterStatus;
  changed: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHARACTER_KEYS = new Set([
  'guestId', 'realName', 'wagon', 'profession', 'characterStatus', 'joinedLate',
]);
const WAGON_KEYS = new Set(['id', 'number', 'label']);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Unexpected Bunker character response');
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Unexpected Bunker character response');
  }
  return value;
}

function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected Bunker character response');
  return result;
}

function status(value: unknown): BunkerCharacterStatus {
  if (value !== 'active' && value !== 'saved' && value !== 'excluded') {
    throw new Error('Unexpected Bunker character response');
  }
  return value;
}

function parseCharacter(value: unknown): OwnerBunkerCharacter {
  const character = record(value);
  const wagon = record(character.wagon);
  if (!exactKeys(character, CHARACTER_KEYS)
    || !exactKeys(wagon, WAGON_KEYS)
    || typeof wagon.number !== 'number'
    || !Number.isInteger(wagon.number)
    || wagon.number < 1
    || typeof character.joinedLate !== 'boolean') {
    throw new Error('Unexpected Bunker character response');
  }
  return {
    guestId: text(character.guestId),
    realName: text(character.realName),
    wagon: {
      id: text(wagon.id),
      number: wagon.number,
      label: text(wagon.label),
    },
    profession: text(character.profession),
    characterStatus: status(character.characterStatus),
    joinedLate: character.joinedLate,
  };
}

function rpcError(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Bunker character request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export function parseOwnerBunkerCharacters(data: unknown): OwnerBunkerCharacters {
  const root = record(data);
  const serverNow = timestamp(root.serverNow);
  if (!Array.isArray(root.characters)) throw new Error('Unexpected Bunker character response');
  if (root.status === 'idle') {
    if (root.characters.length !== 0) throw new Error('Unexpected Bunker character response');
    return { status: 'idle', characters: [], serverNow };
  }
  if (root.status !== 'active' || typeof root.runNonce !== 'string' || !UUID.test(root.runNonce)) {
    throw new Error('Unexpected Bunker character response');
  }
  return {
    status: 'active',
    runNonce: root.runNonce,
    characters: root.characters.map(parseCharacter),
    serverNow,
  };
}

function parseUpdated(data: unknown): UpdatedBunkerCharacterStatus {
  const root = record(data);
  if (root.status !== 'updated' || typeof root.changed !== 'boolean') {
    throw new Error('Unexpected Bunker character status response');
  }
  return {
    status: 'updated',
    guestId: text(root.guestId),
    characterStatus: status(root.characterStatus),
    changed: root.changed,
  };
}

export async function getOwnerBunkerCharacters(
  client: BunkerRpcClient,
  eventId: string,
): Promise<OwnerBunkerCharacters> {
  const { data, error } = await client.rpc('owner_get_bunker_characters', {
    p_event_id: eventId,
  });
  if (error) rpcError(error);
  return parseOwnerBunkerCharacters(data);
}

export async function setOwnerBunkerCharacterStatus(
  client: BunkerRpcClient,
  eventId: string,
  guestId: string,
  nextStatus: BunkerCharacterStatus,
): Promise<UpdatedBunkerCharacterStatus> {
  const { data, error } = await client.rpc('owner_set_bunker_character_status', {
    p_event_id: eventId,
    p_guest_id: guestId,
    p_status: nextStatus,
  });
  if (error) rpcError(error);
  return parseUpdated(data);
}
