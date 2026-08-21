import { submitBunkerCommand, throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type MissionTwoRpcClient = BunkerV2RpcClient;
export type MissionTwoEvidence = { key: string; label: string; body: string };
export type MissionTwoQuestion = { key: string; prompt: string; options: string[] };
export type MissionTwoAbility = { available: boolean; key: 'system_access' | 'terminal_hack'; label: string; hint: string } | null;

export type MissionTwoGuestReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
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

export type MissionTwoScreenReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      title: string;
      subtitle: string;
      wagons: Array<{ wagonId: string; label: string; status: 'active' | 'completed'; attemptCount: number }>;
    };

export type MissionTwoOwnerReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      title: string;
      wagons: Array<{ wagonId: string; label: string; status: 'active' | 'completed'; attemptCount: number; hintsUsed: number }>;
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
function timestamp(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected mission two timestamp');
  return result;
}
function evidence(value: unknown): MissionTwoEvidence[] {
  if (!Array.isArray(value) || value.length !== 6) throw new Error('Unexpected mission two evidence');
  return value.map((entry) => {
    const row = exact(entry, ['key', 'label', 'body'], 'evidence');
    return { key: text(row.key, 'evidence key'), label: text(row.label, 'evidence label'), body: text(row.body, 'evidence body') };
  });
}
function questions(value: unknown): MissionTwoQuestion[] {
  if (!Array.isArray(value) || value.length !== 3) throw new Error('Unexpected mission two questions');
  return value.map((entry) => {
    const row = exact(entry, ['key', 'prompt', 'options'], 'question');
    if (!Array.isArray(row.options) || row.options.length < 2) throw new Error('Unexpected mission two options');
    return { key: text(row.key, 'question key'), prompt: text(row.prompt, 'question prompt'), options: row.options.map((option) => text(option, 'option')) };
  });
}
function ability(value: unknown): MissionTwoAbility {
  if (value === null) return null;
  const row = exact(value, ['available', 'key', 'label', 'hint'], 'ability');
  if (typeof row.available !== 'boolean' || (row.key !== 'system_access' && row.key !== 'terminal_hack')) throw new Error('Unexpected mission two ability');
  return { available: row.available, key: row.key, label: text(row.label, 'ability label'), hint: text(row.hint, 'ability hint') };
}

export function parseMissionTwoGuestReadModel(value: unknown): MissionTwoGuestReadModel {
  const base = object(value, 'read model');
  if (base.contractVersion !== 2 || typeof base.status !== 'string') throw new Error('Unexpected mission two read model');
  if (base.status === 'idle' || base.status === 'legacy' || base.status === 'not_found') {
    const row = exact(value, ['contractVersion', 'status', 'serverNow'], 'inactive read model');
    return { contractVersion: 2, status: base.status, serverNow: timestamp(row.serverNow) };
  }
  if (base.status !== 'active' && base.status !== 'completed') throw new Error('Unexpected mission two status');
  const allowed = ['contractVersion','status','serverNow','instanceId','instanceVersion','deadlineAt','title','subtitle','intro','wagon','evidence','questions','attemptCount','attemptsRemaining','selectedAnswers','ability','outcome','archiveUnlocked'];
  if (Object.keys(base).some((key) => !allowed.includes(key))) throw new Error('Unexpected mission two read model');
  const wagon = exact(base.wagon, ['number', 'label'], 'wagon');
  const selected = base.selectedAnswers;
  if (!Array.isArray(selected) || selected.length !== 3 || selected.some((item) => typeof item !== 'string')) throw new Error('Unexpected mission two answers');
  const result: MissionTwoGuestReadModel = {
    contractVersion: 2,
    status: base.status,
    serverNow: timestamp(base.serverNow),
    instanceId: text(base.instanceId, 'instance id'),
    instanceVersion: integer(base.instanceVersion, 'instance version'),
    deadlineAt: timestamp(base.deadlineAt),
    title: text(base.title, 'title'), subtitle: text(base.subtitle, 'subtitle'), intro: text(base.intro, 'intro'),
    wagon: { number: integer(wagon.number, 'wagon number'), label: text(wagon.label, 'wagon label') },
    evidence: evidence(base.evidence), questions: questions(base.questions),
    attemptCount: integer(base.attemptCount, 'attempt count'), attemptsRemaining: integer(base.attemptsRemaining, 'attempts remaining'),
    selectedAnswers: selected as string[], ability: ability(base.ability),
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

export async function getGuestMissionTwoReadModel(client: MissionTwoRpcClient, eventSlug: string, deviceKey: string): Promise<MissionTwoGuestReadModel> {
  const { data, error } = await client.rpc('get_guest_bunker_v2_m02', { p_event_slug: eventSlug, p_device_key: deviceKey });
  if (error) throwBunkerV2RpcError(error, 'Mission two read failed');
  return parseMissionTwoGuestReadModel(data);
}

export async function getMissionTwoScreenReadModel(client: MissionTwoRpcClient, eventSlug: string): Promise<MissionTwoScreenReadModel> {
  const { data, error } = await client.rpc('get_bunker_v2_m02_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Mission two screen read failed');
  return data as MissionTwoScreenReadModel;
}

export async function getOwnerMissionTwoReadModel(client: MissionTwoRpcClient, eventId: string): Promise<MissionTwoOwnerReadModel> {
  const { data, error } = await client.rpc('get_owner_bunker_v2_m02', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Mission two owner read failed');
  return data as MissionTwoOwnerReadModel;
}

export function submitMissionTwoAnswers(client: MissionTwoRpcClient, input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; answers: string[] }): Promise<BunkerCommandReceipt> {
  if (input.answers.length !== 3 || input.answers.some((answer) => !answer.trim())) return Promise.reject(new Error('Mission two requires three answers'));
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, { type: 'submit_answer', payload: { instanceId: input.instanceId, answers: [...input.answers] } });
}

export function useMissionTwoAbility(client: MissionTwoRpcClient, input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; abilityKey: 'system_access' | 'terminal_hack' }): Promise<BunkerCommandReceipt> {
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, { type: 'use_ability', payload: { instanceId: input.instanceId, problemKey: input.abilityKey } });
}
