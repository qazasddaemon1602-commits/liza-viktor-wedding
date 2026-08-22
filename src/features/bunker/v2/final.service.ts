import { submitBunkerCommand, throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type FinalRpcClient = BunkerV2RpcClient;
export type FinalParameter = 'coordinates' | 'sector' | 'access_code' | 'gate_time' | 'password';
export type FinalFragment = {
  parameter: FinalParameter;
  label: string;
  part: number;
  totalParts: number;
  value: string;
};
export type FinalValues = {
  coordinates: string;
  sector: string;
  accessCode: string;
  gateTime: string;
  password: string;
};
export type FinalHint = { level: number; text: string };
export type FinalGuestReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      title: string;
      instanceId: string;
      wagon: { number: number; label: string };
      fragments: FinalFragment[];
      terminal: { solved: number; total: number; wrongAttempts: number; unlocked: boolean };
      hint: FinalHint;
      timeAdjustmentSeconds: number;
    };
export type FinalScreenReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      solved: number;
      total: number;
      wrongAttempts: number;
      unlocked: boolean;
      hintLevel: number;
      timeAdjustmentSeconds: number;
    };
export type FinalOwnerReadModel = FinalScreenReadModel;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected final ${label}`);
  }
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const parsed = object(value, label);
  const actual = Object.keys(parsed);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`Unexpected final ${label}`);
  }
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Unexpected final ${label}`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`Unexpected final ${label}`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const parsed = integer(value, label);
  if (parsed < 0) throw new Error(`Unexpected final ${label}`);
  return parsed;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected final ${label}`);
  return value;
}

function timestamp(value: unknown): string {
  const parsed = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(parsed))) throw new Error('Unexpected final timestamp');
  return parsed;
}

const PARAMETERS = new Set<FinalParameter>([
  'coordinates', 'sector', 'access_code', 'gate_time', 'password',
]);

function parseFragment(value: unknown): FinalFragment {
  const fragment = exact(value, ['parameter','label','part','totalParts','value'], 'fragment');
  const parameter = text(fragment.parameter, 'parameter') as FinalParameter;
  if (!PARAMETERS.has(parameter)) throw new Error('Unexpected final parameter');
  const part = nonNegativeInteger(fragment.part, 'part');
  const totalParts = nonNegativeInteger(fragment.totalParts, 'total parts');
  if (part < 1 || totalParts < 1 || part > totalParts) throw new Error('Unexpected final fragment parts');
  return {
    parameter,
    label: text(fragment.label, 'fragment label'),
    part,
    totalParts,
    value: text(fragment.value, 'fragment value'),
  };
}

export function parseFinalGuestReadModel(value: unknown): FinalGuestReadModel {
  const input = object(value, 'read model');
  if (input.contractVersion !== 2 || typeof input.status !== 'string') {
    throw new Error('Unexpected final read model');
  }

  if (input.status === 'idle' || input.status === 'legacy' || input.status === 'not_found') {
    const inactive = exact(value, ['contractVersion','status','serverNow'], 'inactive read model');
    return {
      contractVersion: 2,
      status: input.status,
      serverNow: timestamp(inactive.serverNow),
    };
  }

  if (input.status !== 'active' && input.status !== 'completed') {
    throw new Error('Unexpected final status');
  }

  const active = exact(value, [
    'contractVersion','status','serverNow','deadlineAt','title','instanceId',
    'wagon','fragments','terminal','hint','timeAdjustmentSeconds',
  ], 'read model');
  if (!Array.isArray(active.fragments)) throw new Error('Unexpected final fragments');

  const wagon = exact(active.wagon, ['number','label'], 'wagon');
  const wagonNumber = nonNegativeInteger(wagon.number, 'wagon number');
  if (wagonNumber < 1 || wagonNumber > 5) throw new Error('Unexpected final wagon number');

  const terminal = exact(active.terminal, ['solved','total','wrongAttempts','unlocked'], 'terminal');
  const solved = nonNegativeInteger(terminal.solved, 'solved');
  const total = nonNegativeInteger(terminal.total, 'total');
  const wrongAttempts = nonNegativeInteger(terminal.wrongAttempts, 'wrong attempts');
  if (total < 1 || solved > total) throw new Error('Unexpected final solved count');

  const hint = exact(active.hint, ['level','text'], 'hint');
  const hintLevel = nonNegativeInteger(hint.level, 'hint level');
  if (hintLevel > 3 || typeof hint.text !== 'string') throw new Error('Unexpected final hint');

  const timeAdjustmentSeconds = integer(active.timeAdjustmentSeconds, 'time adjustment');
  if (timeAdjustmentSeconds < -300 || timeAdjustmentSeconds > 600 || timeAdjustmentSeconds % 60 !== 0) {
    throw new Error('Unexpected final time adjustment');
  }

  return {
    contractVersion: 2,
    status: input.status,
    serverNow: timestamp(active.serverNow),
    deadlineAt: timestamp(active.deadlineAt),
    title: text(active.title, 'title'),
    instanceId: text(active.instanceId, 'instance'),
    wagon: {
      number: wagonNumber,
      label: text(wagon.label, 'wagon label'),
    },
    fragments: active.fragments.map(parseFragment),
    terminal: {
      solved,
      total,
      wrongAttempts,
      unlocked: boolean(terminal.unlocked, 'unlocked'),
    },
    hint: {
      level: hintLevel,
      text: hint.text,
    },
    timeAdjustmentSeconds,
  };
}

export async function getGuestFinalReadModel(
  client: FinalRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<FinalGuestReadModel> {
  const { data, error } = await client.rpc('get_guest_bunker_v2_final', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Final read failed');
  return parseFinalGuestReadModel(data);
}

export async function getFinalScreenReadModel(
  client: FinalRpcClient,
  eventSlug: string,
): Promise<FinalScreenReadModel> {
  const { data, error } = await client.rpc('get_bunker_v2_final_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Final screen read failed');
  return data as FinalScreenReadModel;
}

export async function getOwnerFinalReadModel(
  client: FinalRpcClient,
  eventId: string,
): Promise<FinalOwnerReadModel> {
  const { data, error } = await client.rpc('get_owner_bunker_v2_final', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Final owner read failed');
  return data as FinalOwnerReadModel;
}

export function requestFinalAccess(
  client: FinalRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; values: FinalValues },
): Promise<BunkerCommandReceipt> {
  const values = input.values;
  if (Object.values(values).some((value) => !value.trim())) {
    return Promise.reject(new Error('All five final fields are required'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'request_access',
    payload: {
      coordinates: values.coordinates,
      sector: values.sector,
      accessCode: values.accessCode,
      gateTime: values.gateTime,
      password: values.password,
    },
  });
}

async function owner(client: FinalRpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throwBunkerV2RpcError(error, 'Final owner command failed');
  return data;
}

export function addFinalTime(client: FinalRpcClient, eventId: string, seconds = 120) {
  return owner(client, 'owner_bunker_v2_add_final_time', { p_event_id: eventId, p_seconds: seconds });
}

export function giveFinalHint(client: FinalRpcClient, eventId: string) {
  return owner(client, 'owner_bunker_v2_final_hint', { p_event_id: eventId });
}

export function emergencyOpenFinal(client: FinalRpcClient, eventId: string) {
  return owner(client, 'owner_bunker_v2_emergency_open', { p_event_id: eventId });
}
