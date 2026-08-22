import {
  submitBunkerCommand,
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type MissionThreeRpcClient = BunkerV2RpcClient;
export type MissionThreeProblem = { key: string; title: string; risk: string; itemKey: string };
export type MissionThreeInventoryItem = { itemKey: string; quantity: number; status: string };
export type MissionThreeAbility = {
  available: boolean;
  key: string;
  problemKey: string;
  label: string;
} | null;
export type MissionThreeCommitment = {
  problemKey: string;
  status: 'pending' | 'committed' | 'rejected';
  label: string;
};
export type MissionThreeGuestReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      instanceId: string;
      instanceVersion: number;
      title: string;
      intro: string;
      wagon: { number: number; label: string };
      memberRole: 'captain' | 'member';
      problems: MissionThreeProblem[];
      inventory: MissionThreeInventoryItem[];
      selectedProblems: string[];
      ability: MissionThreeAbility;
      pendingCommitments: MissionThreeCommitment[];
      outcome?: Record<string, unknown>;
    };
export type MissionThreeScreenReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      title: string;
      wagons: Array<{
        wagonId: string;
        label: string;
        status: 'active' | 'completed';
        solvedCount: number;
      }>;
    };
export type MissionThreeOwnerReadModel = MissionThreeScreenReadModel;

function obj(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected mission three ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected mission three ${label}`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected mission three ${label}`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected mission three ${label}`);
  return value;
}

function time(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected mission three timestamp');
  return result;
}

function parseProblem(value: unknown): MissionThreeProblem {
  const problem = obj(value, 'problem');
  return {
    key: text(problem.key, 'problem key'),
    title: text(problem.title, 'problem title'),
    risk: text(problem.risk, 'problem risk'),
    itemKey: text(problem.itemKey, 'item key'),
  };
}

function parseInventory(value: unknown): MissionThreeInventoryItem {
  const item = obj(value, 'inventory');
  return {
    itemKey: text(item.itemKey, 'item key'),
    quantity: integer(item.quantity, 'quantity'),
    status: text(item.status, 'inventory status'),
  };
}

function parseAbility(value: unknown): MissionThreeAbility {
  if (value === null) return null;
  const ability = obj(value, 'ability');
  return {
    available: boolean(ability.available, 'ability available'),
    key: text(ability.key, 'ability key'),
    problemKey: text(ability.problemKey, 'problem key'),
    label: text(ability.label, 'ability label'),
  };
}

function parseCommitment(value: unknown): MissionThreeCommitment {
  const commitment = obj(value, 'commitment');
  if (
    commitment.status !== 'pending'
    && commitment.status !== 'committed'
    && commitment.status !== 'rejected'
  ) {
    throw new Error('Unexpected mission three commitment status');
  }
  return {
    problemKey: text(commitment.problemKey, 'problem key'),
    status: commitment.status,
    label: text(commitment.label, 'label'),
  };
}

function parseOutcome(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) return undefined;
  return obj(value, 'outcome');
}

export function parseMissionThreeGuestReadModel(value: unknown): MissionThreeGuestReadModel {
  const row = obj(value, 'read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission three read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission three status');
  }
  if (
    !Array.isArray(row.problems)
    || row.problems.length !== 5
    || !Array.isArray(row.inventory)
    || !Array.isArray(row.selectedProblems)
    || !Array.isArray(row.pendingCommitments)
  ) {
    throw new Error('Unexpected mission three payload');
  }
  if (row.memberRole !== 'captain' && row.memberRole !== 'member') {
    throw new Error('Unexpected mission three member role');
  }

  const problems = row.problems.map(parseProblem);
  const problemKeys = new Set(problems.map((problem) => problem.key));
  if (problemKeys.size !== problems.length) throw new Error('Unexpected mission three duplicate problem');

  const selectedProblems = row.selectedProblems.map((entry) => text(entry, 'selection'));
  if (
    new Set(selectedProblems).size !== selectedProblems.length
    || selectedProblems.some((problemKey) => !problemKeys.has(problemKey))
  ) {
    throw new Error('Unexpected mission three selection');
  }

  const wagon = obj(row.wagon, 'wagon');
  const outcome = parseOutcome(row.outcome);
  return {
    contractVersion: 2,
    status: row.status,
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    instanceId: text(row.instanceId, 'instance'),
    instanceVersion: integer(row.instanceVersion, 'version'),
    title: text(row.title, 'title'),
    intro: text(row.intro, 'intro'),
    wagon: {
      number: integer(wagon.number, 'wagon number'),
      label: text(wagon.label, 'wagon label'),
    },
    memberRole: row.memberRole,
    problems,
    inventory: row.inventory.map(parseInventory),
    selectedProblems,
    ability: parseAbility(row.ability),
    pendingCommitments: row.pendingCommitments.map(parseCommitment),
    ...(outcome ? { outcome } : {}),
  };
}

export function parseMissionThreeScreenReadModel(value: unknown): MissionThreeScreenReadModel {
  const row = obj(value, 'screen read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission three screen read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission three screen status');
  }
  if (!Array.isArray(row.wagons)) throw new Error('Unexpected mission three screen wagons');

  return {
    contractVersion: 2,
    status: row.status,
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    title: text(row.title, 'screen title'),
    wagons: row.wagons.map((entry) => {
      const wagon = obj(entry, 'screen wagon');
      if (wagon.status !== 'active' && wagon.status !== 'completed') {
        throw new Error('Unexpected mission three wagon status');
      }
      return {
        wagonId: text(wagon.wagonId, 'wagon id'),
        label: text(wagon.label, 'wagon label'),
        status: wagon.status,
        solvedCount: integer(wagon.solvedCount, 'solved count'),
      };
    }),
  };
}

export async function getGuestMissionThreeReadModel(
  client: MissionThreeRpcClient,
  eventSlug: string,
  deviceKey: string,
) {
  const { data, error } = await client.rpc('get_guest_bunker_v2_m03', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Mission three read failed');
  return parseMissionThreeGuestReadModel(data);
}

export async function getMissionThreeScreenReadModel(
  client: MissionThreeRpcClient,
  eventSlug: string,
) {
  const { data, error } = await client.rpc('get_bunker_v2_m03_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Mission three screen read failed');
  return parseMissionThreeScreenReadModel(data);
}

export async function getOwnerMissionThreeReadModel(
  client: MissionThreeRpcClient,
  eventId: string,
) {
  const { data, error } = await client.rpc('get_owner_bunker_v2_m03', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Mission three owner read failed');
  return parseMissionThreeScreenReadModel(data);
}

export function commitMissionThreeAbility(
  client: MissionThreeRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; problemKey: string },
): Promise<BunkerCommandReceipt> {
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'use_ability',
    payload: { instanceId: input.instanceId, problemKey: input.problemKey },
  });
}

export function confirmMissionThree(
  client: MissionThreeRpcClient,
  input: {
    eventSlug: string;
    deviceKey: string;
    commandId: string;
    instanceId: string;
    instanceVersion: number;
    selectedProblems: string[];
  },
): Promise<BunkerCommandReceipt> {
  if (input.selectedProblems.length < 1 || input.selectedProblems.length > 3) {
    return Promise.reject(new Error('Mission three allows one to three selected problems'));
  }
  if (new Set(input.selectedProblems).size !== input.selectedProblems.length) {
    return Promise.reject(new Error('Mission three selection must be unique'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'mission_confirm',
    payload: {
      instanceId: input.instanceId,
      instanceVersion: input.instanceVersion,
      selection: [...input.selectedProblems],
    },
  });
}
