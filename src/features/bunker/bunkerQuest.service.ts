import type { BunkerRpcClient, BunkerRpcError } from './bunker.service';
import type {
  BunkerMissionStage,
  BunkerPhase,
  GuestBunkerDossier,
  GuestBunkerMission,
  GuestBunkerQuestState,
  GuestBunkerTeamState,
  OwnerBunkerQuestState,
  OwnerBunkerTeamStage,
  OwnerBunkerTeamState,
  SubmitBunkerFinalResult,
  SubmitBunkerMissionResult,
} from './bunkerQuest.types';

const PHASES = new Set<BunkerPhase>([
  'emergency',
  'dossier_1',
  'dossier_2',
  'mission_a',
  'mission_b',
  'final',
  'completed',
]);
const STAGES = new Set<BunkerMissionStage>(['mission_a', 'mission_b']);

function rpcError(error: Exclude<BunkerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Bunker quest request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function timestamp(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Unexpected Bunker quest timestamp');
  }
  return value;
}

function integer(value: unknown, label = 'number'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected Bunker quest ${label}`);
  }
  return value;
}

function requiredString(value: unknown, label = 'text'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected Bunker quest ${label}`);
  }
  return value;
}

function nullableString(value: unknown, label = 'text'): string | null {
  if (value === null) return null;
  return requiredString(value, label);
}

function boolean(value: unknown, label = 'flag'): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected Bunker quest ${label}`);
  return value;
}

function phase(value: unknown): BunkerPhase {
  if (typeof value !== 'string' || !PHASES.has(value as BunkerPhase)) {
    throw new Error('Unexpected Bunker quest phase');
  }
  return value as BunkerPhase;
}

function stage(value: unknown): BunkerMissionStage {
  if (typeof value !== 'string' || !STAGES.has(value as BunkerMissionStage)) {
    throw new Error('Unexpected Bunker mission stage');
  }
  return value as BunkerMissionStage;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('Unexpected Bunker quest mission options');
  }
  return value as string[];
}

function parseDossier(value: unknown): GuestBunkerDossier | null {
  if (value === null) return null;
  if (!record(value)) throw new Error('Unexpected Bunker quest dossier');
  return {
    profession: requiredString(value.profession, 'profession'),
    profile: requiredString(value.profile, 'profile'),
    health: nullableString(value.health, 'health'),
    hobby: nullableString(value.hobby, 'hobby'),
    baggage: nullableString(value.baggage, 'baggage'),
    hiddenFact: nullableString(value.hiddenFact, 'hidden fact'),
  };
}

function parseMission(value: unknown): GuestBunkerMission {
  if (!record(value)) throw new Error('Unexpected Bunker guest mission');
  return {
    title: requiredString(value.title, 'mission title'),
    prompt: requiredString(value.prompt, 'mission prompt'),
    options: stringArray(value.options),
  };
}

function parseGuestTeam(value: unknown): GuestBunkerTeamState | null {
  if (value === null) return null;
  if (!record(value)) throw new Error('Unexpected Bunker guest team');
  const result: GuestBunkerTeamState = {
    carriageNumber: integer(value.carriageNumber, 'carriage number'),
    completed: boolean(value.completed, 'completion flag'),
    fragment: nullableString(value.fragment, 'fragment'),
  };
  if (value.stage !== undefined) result.stage = stage(value.stage);
  if (value.mission !== undefined) result.mission = parseMission(value.mission);
  if (value.attemptCount !== undefined) result.attemptCount = integer(value.attemptCount, 'attempt count');
  return result;
}

export function parseGuestBunkerQuest(data: unknown): GuestBunkerQuestState {
  if (!record(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected Bunker guest state');
  }
  const serverNow = timestamp(data.serverNow) as string;
  if (data.status === 'idle' || data.status === 'not_found' || data.status === 'guest_not_found') {
    return { status: data.status, serverNow };
  }
  if (data.status !== 'active') throw new Error('Unexpected Bunker guest status');

  return {
    status: 'active',
    phase: phase(data.phase),
    phaseStartedAt: timestamp(data.phaseStartedAt, true),
    startedAt: timestamp(data.startedAt) as string,
    durationSeconds: integer(data.durationSeconds, 'duration'),
    remainingSeconds: integer(data.remainingSeconds, 'remaining time'),
    serverNow,
    dossier: parseDossier(data.dossier),
    team: parseGuestTeam(data.team),
    final: record(data.final)
      ? { unlocked: boolean(data.final.unlocked, 'unlock flag') }
      : (() => { throw new Error('Unexpected Bunker final state'); })(),
  };
}

function parseOwnerStage(value: unknown): OwnerBunkerTeamStage {
  if (!record(value)) throw new Error('Unexpected Bunker owner mission stage');
  return {
    completed: boolean(value.completed, 'team completion flag'),
    attemptCount: integer(value.attemptCount, 'attempt count'),
    hint: nullableString(value.hint, 'owner hint'),
  };
}

function parseOwnerTeam(value: unknown): OwnerBunkerTeamState {
  if (!record(value)) throw new Error('Unexpected Bunker owner team');
  const missionB = parseOwnerStage(value.missionB);
  if (!record(value.missionB)) throw new Error('Unexpected Bunker owner Mission B');
  return {
    carriageId: requiredString(value.carriageId, 'carriage id'),
    carriageNumber: integer(value.carriageNumber, 'carriage number'),
    label: requiredString(value.label, 'carriage label'),
    missionA: parseOwnerStage(value.missionA),
    missionB: {
      ...missionB,
      fragment: nullableString(value.missionB.fragment, 'fragment'),
    },
  };
}

export function parseOwnerBunkerQuest(data: unknown): OwnerBunkerQuestState {
  if (!record(data) || typeof data.status !== 'string' || !Array.isArray(data.teams)) {
    throw new Error('Unexpected Bunker owner state');
  }
  const serverNow = timestamp(data.serverNow) as string;
  const teams = data.teams.map(parseOwnerTeam);
  if (data.status === 'idle') {
    return {
      status: 'idle',
      phase: 'emergency',
      remainingSeconds: 0,
      teams,
      unlocked: false,
      serverNow,
    };
  }
  if (data.status !== 'active') throw new Error('Unexpected Bunker owner status');
  return {
    status: 'active',
    phase: phase(data.phase),
    phaseStartedAt: timestamp(data.phaseStartedAt, true),
    startedAt: timestamp(data.startedAt) as string,
    durationSeconds: integer(data.durationSeconds, 'duration'),
    remainingSeconds: integer(data.remainingSeconds, 'remaining time'),
    soundEnabled: boolean(data.soundEnabled, 'sound flag'),
    unlocked: boolean(data.unlocked, 'unlock flag'),
    teams,
    serverNow,
  };
}

async function rpc(client: BunkerRpcClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) rpcError(error);
  return data;
}

export async function getGuestBunkerQuest(
  client: BunkerRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<GuestBunkerQuestState> {
  return parseGuestBunkerQuest(await rpc(client, 'get_guest_bunker_state', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  }));
}

export async function getOwnerBunkerQuest(
  client: BunkerRpcClient,
  eventId: string,
): Promise<OwnerBunkerQuestState> {
  return parseOwnerBunkerQuest(await rpc(client, 'owner_get_bunker_quest', { p_event_id: eventId }));
}

export async function submitBunkerMission(
  client: BunkerRpcClient,
  eventSlug: string,
  deviceKey: string,
  missionStage: BunkerMissionStage,
  answer: string,
): Promise<SubmitBunkerMissionResult> {
  const data = await rpc(client, 'submit_guest_bunker_mission', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_stage: missionStage,
    p_answer: answer,
  });
  if (!record(data) || (data.status !== 'incorrect' && data.status !== 'completed')) {
    throw new Error('Unexpected Bunker mission response');
  }
  const result: SubmitBunkerMissionResult = {
    status: data.status,
    stage: stage(data.stage),
  };
  if (data.attemptCount !== undefined) result.attemptCount = integer(data.attemptCount, 'attempt count');
  if (data.successCopy !== undefined) result.successCopy = requiredString(data.successCopy, 'success copy');
  if (data.fragment !== undefined) result.fragment = nullableString(data.fragment, 'fragment');
  return result;
}

export async function submitBunkerFinalCode(
  client: BunkerRpcClient,
  eventSlug: string,
  deviceKey: string,
  code: string,
): Promise<SubmitBunkerFinalResult> {
  const data = await rpc(client, 'submit_guest_bunker_final_code', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_code: code,
  });
  if (
    !record(data)
    || (data.status !== 'not_ready' && data.status !== 'incorrect' && data.status !== 'unlocked')
  ) {
    throw new Error('Unexpected Bunker final response');
  }
  return { status: data.status, unlocked: boolean(data.unlocked, 'unlock flag') };
}

async function ownerCommand(
  client: BunkerRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<OwnerBunkerQuestState> {
  return parseOwnerBunkerQuest(await rpc(client, name, args));
}

export function beginBunkerQuest(client: BunkerRpcClient, eventId: string) {
  return ownerCommand(client, 'owner_begin_bunker_quest', { p_event_id: eventId });
}

export function advanceBunkerPhase(client: BunkerRpcClient, eventId: string, nextPhase: BunkerPhase) {
  return ownerCommand(client, 'owner_advance_bunker_phase', {
    p_event_id: eventId,
    p_phase: nextPhase,
  });
}

export function resetBunkerTeamStage(
  client: BunkerRpcClient,
  eventId: string,
  carriageId: string,
  missionStage: BunkerMissionStage,
) {
  return ownerCommand(client, 'owner_reset_bunker_team_stage', {
    p_event_id: eventId,
    p_carriage_id: carriageId,
    p_stage: missionStage,
  });
}

export function forceCompleteBunkerTeamStage(
  client: BunkerRpcClient,
  eventId: string,
  carriageId: string,
  missionStage: BunkerMissionStage,
) {
  return ownerCommand(client, 'owner_force_complete_bunker_team_stage', {
    p_event_id: eventId,
    p_carriage_id: carriageId,
    p_stage: missionStage,
  });
}

export function unlockBunker(client: BunkerRpcClient, eventId: string) {
  return ownerCommand(client, 'owner_unlock_bunker', { p_event_id: eventId });
}
