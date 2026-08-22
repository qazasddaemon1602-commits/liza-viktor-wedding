import { submitBunkerCommand, throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type MissionTwoRpcClient = BunkerV2RpcClient;
export type MissionTwoEvidence = { key: string; label: string; body: string };
export type MissionTwoQuestion = { key: string; prompt: string; options: string[] };
export type MissionTwoAbility = { available: boolean; key: 'system_access' | 'terminal_hack'; label: string; hint: string } | null;

type MissionTwoInactive = { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string };
type MissionTwoScreenWagon = { wagonId: string; label: string; status: 'active' | 'completed'; attemptCount: number };

export type MissionTwoGuestReadModel = MissionTwoInactive | {
  contractVersion: 2;
  status: 'active' | 'completed';
  serverNow: string;
  instanceId: string;
  instanceVersion: number;
  deadlineAt: string;
  title: string;
  subtitle: string;
  intro: string;
  wagon: { number: number; label: string };
  evidence: MissionTwoEvidence[];
  questions: MissionTwoQuestion[];
  attemptCount: number;
  attemptsRemaining: number;
  selectedAnswers: string[];
  ability: MissionTwoAbility;
  outcome?: 'success' | 'black_box_incomplete';
  archiveUnlocked?: 'BK-17';
};

export type MissionTwoScreenReadModel = MissionTwoInactive | {
  contractVersion: 2;
  status: 'active' | 'completed';
  serverNow: string;
  deadlineAt: string;
  title: string;
  subtitle: string;
  wagons: MissionTwoScreenWagon[];
};

export type MissionTwoOwnerReadModel = MissionTwoInactive | {
  contractVersion: 2;
  status: 'active' | 'completed';
  serverNow: string;
  deadlineAt: string;
  title: string;
  wagons: Array<MissionTwoScreenWagon & { hintsUsed: number }>;
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Unexpected mission two ${label}`);
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const row = object(value, label);
  const actual = Object.keys(row);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) throw new Error(`Unexpected mission two ${label}`);
  return row;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Unexpected mission two ${label}`);
  return value;
}
function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error(`Unexpected mission two ${label}`);
  return value;
}
function positiveInteger(value: unknown, label: string): number {
  const result = integer(value, label);
  if (result < 1) throw new Error(`Unexpected mission two ${label}`);
  return result;
}
function timestamp(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected mission two timestamp');
  return result;
}
function evidence(value: unknown): MissionTwoEvidence[] {
  if (!Array.isArray(value) || value.length !== 6) throw new Error('Unexpected mission two evidence');
  const result = value.map((entry) => {
    const row = exact(entry, ['key', 'label', 'body'], 'evidence');
    return { key: text(row.key, 'evidence key'), label: text(row.label, 'evidence label'), body: text(row.body, 'evidence body') };
  });
  if (new Set(result.map((entry) => entry.key)).size !== result.length) throw new Error('Unexpected mission two evidence');
  return result;
}
function questions(value: unknown): MissionTwoQuestion[] {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('Unexpected mission two questions');
  const result = value.map((entry) => {
    const row = exact(entry, ['key', 'prompt', 'options'], 'question');
    if (!Array.isArray(row.options) || row.options.length < 2) throw new Error('Unexpected mission two options');
    const options = row.options.map((option) => text(option, 'option'));
    if (new Set(options).size !== options.length) throw new Error('Unexpected mission two options');
    return { key: text(row.key, 'question key'), prompt: text(row.prompt, 'question prompt'), options };
  });
  if (new Set(result.map((entry) => entry.key)).size !== result.length) throw new Error('Unexpected mission two questions');
  return result;
}
function ability(value: unknown): MissionTwoAbility {
  if (value === null) return null;
  const row = exact(value, ['available', 'key', 'label', 'hint'], 'ability');
  if (typeof row.available !== 'boolean' || (row.key !== 'system_access' && row.key !== 'terminal_hack')) {
    throw new Error('Unexpected mission two ability');
  }
  return { available: row.available, key: row.key, label: text(row.label, 'ability label'), hint: text(row.hint, 'ability hint') };
}
function inactive(value: unknown): MissionTwoInactive | null {
  const row = object(value, 'read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') throw new Error('Unexpected mission two read model');
  if (row.status !== 'idle' && row.status !== 'legacy' && row.status !== 'not_found') return null;
  const parsed = exact(value, ['contractVersion', 'status', 'serverNow'], 'inactive read model');
  return { contractVersion: 2, status: row.status, serverNow: timestamp(parsed.serverNow) };
}
function screenWagon(value: unknown, owner: boolean): MissionTwoScreenWagon & { hintsUsed?: number } {
  const keys = owner
    ? ['wagonId', 'label', 'status', 'attemptCount', 'hintsUsed'] as const
    : ['wagonId', 'label', 'status', 'attemptCount'] as const;
  const row = exact(value, keys, 'screen wagon');
  if (row.status !== 'active' && row.status !== 'completed') throw new Error('Unexpected mission two wagon status');
  const attemptCount = integer(row.attemptCount, 'attempt count');
  if (attemptCount > 2) throw new Error('Unexpected mission two attempt count');
  return {
    wagonId: text(row.wagonId, 'wagon id'),
    label: text(row.label, 'wagon label'),
    status: row.status,
    attemptCount,
    ...(owner ? { hintsUsed: integer(row.hintsUsed, 'hints used') } : {}),
  };
}

export function parseMissionTwoGuestReadModel(value: unknown): MissionTwoGuestReadModel {
  const inactiveModel = inactive(value);
  if (inactiveModel) return inactiveModel;
  const base = object(value, 'read model');
  if (base.status !== 'active' && base.status !== 'completed') throw new Error('Unexpected mission two status');
  const allowed = ['contractVersion','status','serverNow','instanceId','instanceVersion','deadlineAt','title','subtitle','intro','wagon','evidence','questions','attemptCount','attemptsRemaining','selectedAnswers','ability','outcome','archiveUnlocked'];
  if (Object.keys(base).some((key) => !allowed.includes(key))) throw new Error('Unexpected mission two read model');
  const wagon = exact(base.wagon, ['number', 'label'], 'wagon');
  const wagonNumber = positiveInteger(wagon.number, 'wagon number');
  if (wagonNumber > 5) throw new Error('Unexpected mission two wagon number');
  const selected = base.selectedAnswers;
  if (!Array.isArray(selected) || selected.length !== 3 || selected.some((item) => typeof item !== 'string')) {
    throw new Error('Unexpected mission two answers');
  }
  const attemptCount = integer(base.attemptCount, 'attempt count');
  const attemptsRemaining = integer(base.attemptsRemaining, 'attempts remaining');
  if (attemptCount > 2 || attemptsRemaining > 2 || attemptCount + attemptsRemaining !== 2) {
    throw new Error('Unexpected mission two attempt counters');
  }
  const result: MissionTwoGuestReadModel = {
    contractVersion: 2,
    status: base.status,
    serverNow: timestamp(base.serverNow),
    instanceId: text(base.instanceId, 'instance id'),
    instanceVersion: integer(base.instanceVersion, 'instance version'),
    deadlineAt: timestamp(base.deadlineAt),
    title: text(base.title, 'title'),
    subtitle: text(base.subtitle, 'subtitle'),
    intro: text(base.intro, 'intro'),
    wagon: { number: wagonNumber, label: text(wagon.label, 'wagon label') },
    evidence: evidence(base.evidence),
    questions: questions(base.questions),
    attemptCount,
    attemptsRemaining,
    selectedAnswers: selected as string[],
    ability: ability(base.ability),
  };
  if (base.outcome !== undefined) {
    if (base.outcome !== 'success' && base.outcome !== 'black_box_incomplete') throw new Error('Unexpected mission two outcome');
    result.outcome = base.outcome;
  }
  if (base.archiveUnlocked !== undefined) {
    if (base.archiveUnlocked !== 'BK-17') throw new Error('Unexpected mission two archive');
    result.archiveUnlocked = 'BK-17';
  }
  return result;
}

export function parseMissionTwoScreenReadModel(value: unknown): MissionTwoScreenReadModel {
  const inactiveModel = inactive(value);
  if (inactiveModel) return inactiveModel;
  const row = exact(value, ['contractVersion','status','serverNow','deadlineAt','title','subtitle','wagons'], 'screen read model');
  if (row.status !== 'active' && row.status !== 'completed') throw new Error('Unexpected mission two screen status');
  if (!Array.isArray(row.wagons)) throw new Error('Unexpected mission two screen wagons');
  return {
    contractVersion: 2,
    status: row.status,
    serverNow: timestamp(row.serverNow),
    deadlineAt: timestamp(row.deadlineAt),
    title: text(row.title, 'title'),
    subtitle: text(row.subtitle, 'subtitle'),
    wagons: row.wagons.map((entry) => screenWagon(entry, false)),
  };
}

export function parseMissionTwoOwnerReadModel(value: unknown): MissionTwoOwnerReadModel {
  const inactiveModel = inactive(value);
  if (inactiveModel) return inactiveModel;
  const row = exact(value, ['contractVersion','status','serverNow','deadlineAt','title','wagons'], 'owner read model');
  if (row.status !== 'active' && row.status !== 'completed') throw new Error('Unexpected mission two owner status');
  if (!Array.isArray(row.wagons)) throw new Error('Unexpected mission two owner wagons');
  return {
    contractVersion: 2,
    status: row.status,
    serverNow: timestamp(row.serverNow),
    deadlineAt: timestamp(row.deadlineAt),
    title: text(row.title, 'title'),
    wagons: row.wagons.map((entry) => {
      const parsed = screenWagon(entry, true);
      if (parsed.hintsUsed === undefined) throw new Error('Unexpected mission two hints used');
      return { ...parsed, hintsUsed: parsed.hintsUsed };
    }),
  };
}

export async function getGuestMissionTwoReadModel(client: MissionTwoRpcClient, eventSlug: string, deviceKey: string): Promise<MissionTwoGuestReadModel> {
  const { data, error } = await client.rpc('get_guest_bunker_v2_m02', { p_event_slug: eventSlug, p_device_key: deviceKey });
  if (error) throwBunkerV2RpcError(error, 'Mission two read failed');
  return parseMissionTwoGuestReadModel(data);
}
export async function getMissionTwoScreenReadModel(client: MissionTwoRpcClient, eventSlug: string): Promise<MissionTwoScreenReadModel> {
  const { data, error } = await client.rpc('get_bunker_v2_m02_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Mission two screen read failed');
  return parseMissionTwoScreenReadModel(data);
}
export async function getOwnerMissionTwoReadModel(client: MissionTwoRpcClient, eventId: string): Promise<MissionTwoOwnerReadModel> {
  const { data, error } = await client.rpc('get_owner_bunker_v2_m02', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Mission two owner read failed');
  return parseMissionTwoOwnerReadModel(data);
}

export function submitMissionTwoAnswers(client: MissionTwoRpcClient, input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; answers: string[] }): Promise<BunkerCommandReceipt> {
  if (input.answers.length !== 3 || input.answers.some((answer) => !answer.trim())) return Promise.reject(new Error('Mission two requires three answers'));
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, { type: 'submit_answer', payload: { instanceId: input.instanceId, answers: [...input.answers] } });
}
export function useMissionTwoAbility(client: MissionTwoRpcClient, input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; abilityKey: 'system_access' | 'terminal_hack' }): Promise<BunkerCommandReceipt> {
  if (input.abilityKey !== 'system_access' && input.abilityKey !== 'terminal_hack') return Promise.reject(new Error('Mission two ability is invalid'));
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, { type: 'use_ability', payload: { instanceId: input.instanceId, problemKey: input.abilityKey } });
}
