import { BUNKER_V2_GLOBAL_STATES, type BunkerV2GlobalState } from './contracts';
import {
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';

export type PreparedOwnerBunkerV2 = {
  status: 'prepared';
  eventId: string;
  runNonce: string;
  contractVersion: 2;
  planVersion: number;
  globalGameState: 'LOBBY';
  wagonCount: number;
  guestCount: number;
  missionInstanceCount: number;
};

export type TransitionedOwnerBunkerV2 = {
  status: 'transitioned';
  runNonce: string;
  contractVersion: 2;
  previousState: BunkerV2GlobalState;
  globalGameState: BunkerV2GlobalState;
  changed: boolean;
};

const V2_STATES = new Set<string>(BUNKER_V2_GLOBAL_STATES);

function exactObject(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  const parsed = value as Record<string, unknown>;
  const actual = Object.keys(parsed);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value;
}

function state(value: unknown, label: string): BunkerV2GlobalState {
  if (typeof value !== 'string' || !V2_STATES.has(value)) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value as BunkerV2GlobalState;
}

function commandId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function parsePrepared(value: unknown): PreparedOwnerBunkerV2 {
  const receipt = exactObject(value, [
    'status', 'eventId', 'runNonce', 'contractVersion', 'planVersion',
    'globalGameState', 'wagonCount', 'guestCount', 'missionInstanceCount',
  ], 'owner prepare receipt');
  if (
    receipt.status !== 'prepared'
    || receipt.contractVersion !== 2
    || receipt.globalGameState !== 'LOBBY'
  ) throw new Error('Unexpected Bunker V2 owner prepare receipt');
  return {
    status: 'prepared',
    eventId: text(receipt.eventId, 'owner prepare event id'),
    runNonce: text(receipt.runNonce, 'owner prepare run nonce'),
    contractVersion: 2,
    planVersion: positiveInteger(receipt.planVersion, 'owner prepare plan version'),
    globalGameState: 'LOBBY',
    wagonCount: positiveInteger(receipt.wagonCount, 'owner prepare wagon count'),
    guestCount: positiveInteger(receipt.guestCount, 'owner prepare guest count'),
    missionInstanceCount: positiveInteger(
      receipt.missionInstanceCount,
      'owner prepare mission instance count',
    ),
  };
}

function parseTransitioned(value: unknown): TransitionedOwnerBunkerV2 {
  const receipt = exactObject(value, [
    'status', 'runNonce', 'contractVersion', 'previousState',
    'globalGameState', 'changed',
  ], 'owner transition receipt');
  if (
    receipt.status !== 'transitioned'
    || receipt.contractVersion !== 2
    || typeof receipt.changed !== 'boolean'
  ) throw new Error('Unexpected Bunker V2 owner transition receipt');
  return {
    status: 'transitioned',
    runNonce: text(receipt.runNonce, 'owner transition run nonce'),
    contractVersion: 2,
    previousState: state(receipt.previousState, 'owner transition previous state'),
    globalGameState: state(receipt.globalGameState, 'owner transition global state'),
    changed: receipt.changed,
  };
}

async function ownerRpc<T>(
  client: BunkerV2RpcClient,
  name: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwBunkerV2RpcError(error, 'Bunker V2 owner command failed');
  return parse(data);
}

export async function prepareOwnerBunkerV2(
  client: BunkerV2RpcClient,
  eventId: string,
): Promise<PreparedOwnerBunkerV2> {
  const receipt = await ownerRpc(client, 'owner_prepare_bunker_v2', {
    p_event_id: eventId,
    p_command_id: commandId(),
  }, parsePrepared);
  if (receipt.eventId !== eventId) {
    throw new Error('Unexpected Bunker V2 owner prepare receipt correlation');
  }
  return receipt;
}

export async function transitionOwnerBunkerV2(
  client: BunkerV2RpcClient,
  eventId: string,
  nextState: BunkerV2GlobalState,
): Promise<TransitionedOwnerBunkerV2> {
  const receipt = await ownerRpc(client, 'owner_transition_bunker_v2', {
    p_event_id: eventId,
    p_next_state: nextState,
    p_command_id: commandId(),
  }, parseTransitioned);
  if (receipt.globalGameState !== nextState) {
    throw new Error('Unexpected Bunker V2 owner transition receipt correlation');
  }
  return receipt;
}
