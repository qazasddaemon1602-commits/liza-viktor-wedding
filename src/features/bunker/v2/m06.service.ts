import {
  submitBunkerCommand,
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type MissionSixRpcClient = BunkerV2RpcClient;
export type MissionSixFragment = { key: string; label: string; body: string };
export type MissionSixOption = { key: 'A' | 'B' | 'C'; title: string; summary: string };
export type MissionSixConsensus = {
  wagonId: string;
  label: string;
  votesA: number;
  votesB: number;
  votesC: number;
  required: number;
  consensus: 'A' | 'B' | 'C' | null;
};
export type MissionSixOutcome = { status: 'success'; protocol: 'B'; sector: '04'; accessCode: '4719' };
export type MissionSixGuestReadModel =
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
      viewer: { wagonId: string; wagonNumber: number; canVote: boolean };
      privateFragment: MissionSixFragment;
      fragmentShared: boolean;
      revealedFragments: MissionSixFragment[];
      fragmentsRevealed: number;
      fragmentsTotal: number;
      options: MissionSixOption[];
      selectedVote: 'A' | 'B' | 'C' | null;
      wagonConsensus: MissionSixConsensus[];
      ability: { available: boolean; key: string; label: string; hint: string } | null;
      outcome?: MissionSixOutcome;
    };
export type MissionSixScreenReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      title: string;
      fragmentsRevealed: number;
      fragmentsTotal: number;
      wagons: Array<{ wagonId: string; label: string; consensusReady: boolean }>;
    };
export type MissionSixOwnerReadModel = MissionSixScreenReadModel;

type Vote = 'A' | 'B' | 'C';

function obj(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected mission six ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected mission six ${label}`);
  }
  return value;
}

function int(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected mission six ${label}`);
  }
  return value;
}

function positiveInt(value: unknown, label: string): number {
  const result = int(value, label);
  if (result < 1) throw new Error(`Unexpected mission six ${label}`);
  return result;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected mission six ${label}`);
  return value;
}

function time(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected mission six timestamp');
  return result;
}

function vote(value: unknown, label: string, allowNull = false): Vote | null {
  if (allowNull && (value === null || value === undefined)) return null;
  if (value !== 'A' && value !== 'B' && value !== 'C') {
    throw new Error(`Unexpected mission six ${label}`);
  }
  return value;
}

function fragment(value: unknown): MissionSixFragment {
  const row = obj(value, 'fragment');
  return {
    key: text(row.key, 'fragment key'),
    label: text(row.label, 'fragment label'),
    body: text(row.body, 'fragment body'),
  };
}

function option(value: unknown): MissionSixOption {
  const row = obj(value, 'option');
  const key = vote(row.key, 'option key');
  if (key === null) throw new Error('Unexpected mission six option key');
  return {
    key,
    title: text(row.title, 'option title'),
    summary: text(row.summary, 'option summary'),
  };
}

function ability(value: unknown) {
  if (value === null) return null;
  const row = obj(value, 'ability');
  return {
    available: bool(row.available, 'ability available'),
    key: text(row.key, 'ability key'),
    label: text(row.label, 'ability label'),
    hint: text(row.hint, 'ability hint'),
  };
}

function outcome(value: unknown): MissionSixOutcome | undefined {
  if (value === undefined || value === null) return undefined;
  const row = obj(value, 'outcome');
  if (row.status !== 'success' || row.protocol !== 'B' || row.sector !== '04' || row.accessCode !== '4719') {
    throw new Error('Unexpected mission six outcome');
  }
  return { status: 'success', protocol: 'B', sector: '04', accessCode: '4719' };
}

function consensus(value: unknown): MissionSixConsensus {
  const row = obj(value, 'consensus');
  return {
    wagonId: text(row.wagonId, 'wagon id'),
    label: text(row.label, 'wagon label'),
    votesA: int(row.votesA, 'votes A'),
    votesB: int(row.votesB, 'votes B'),
    votesC: int(row.votesC, 'votes C'),
    required: positiveInt(row.required, 'required'),
    consensus: vote(row.consensus, 'consensus', true),
  };
}

export function parseMissionSixGuestReadModel(value: unknown): MissionSixGuestReadModel {
  const row = obj(value, 'read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission six read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission six status');
  }
  if (
    !Array.isArray(row.revealedFragments)
    || !Array.isArray(row.options)
    || row.options.length !== 3
    || !Array.isArray(row.wagonConsensus)
  ) {
    throw new Error('Unexpected mission six payload');
  }

  const options = row.options.map(option);
  const optionKeys = new Set(options.map((entry) => entry.key));
  if (optionKeys.size !== 3 || !optionKeys.has('A') || !optionKeys.has('B') || !optionKeys.has('C')) {
    throw new Error('Unexpected mission six option set');
  }

  const revealedFragments = row.revealedFragments.map(fragment);
  const fragmentsRevealed = int(row.fragmentsRevealed, 'fragments revealed');
  const fragmentsTotal = positiveInt(row.fragmentsTotal, 'fragments total');
  if (fragmentsRevealed > fragmentsTotal || revealedFragments.length !== fragmentsRevealed) {
    throw new Error('Unexpected mission six fragment counts');
  }

  const viewer = obj(row.viewer, 'viewer');
  const parsedOutcome = outcome(row.outcome);
  return {
    contractVersion: 2,
    status: row.status,
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    instanceId: text(row.instanceId, 'instance'),
    instanceVersion: int(row.instanceVersion, 'version'),
    title: text(row.title, 'title'),
    intro: text(row.intro, 'intro'),
    viewer: {
      wagonId: text(viewer.wagonId, 'wagon id'),
      wagonNumber: positiveInt(viewer.wagonNumber, 'wagon number'),
      canVote: bool(viewer.canVote, 'can vote'),
    },
    privateFragment: fragment(row.privateFragment),
    fragmentShared: bool(row.fragmentShared, 'fragment shared'),
    revealedFragments,
    fragmentsRevealed,
    fragmentsTotal,
    options,
    selectedVote: vote(row.selectedVote, 'selected vote', true),
    wagonConsensus: row.wagonConsensus.map(consensus),
    ability: ability(row.ability),
    ...(parsedOutcome ? { outcome: parsedOutcome } : {}),
  };
}

export function parseMissionSixScreenReadModel(value: unknown): MissionSixScreenReadModel {
  const row = obj(value, 'screen read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission six screen read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission six screen status');
  }
  if (!Array.isArray(row.wagons)) throw new Error('Unexpected mission six screen wagons');

  const fragmentsRevealed = int(row.fragmentsRevealed, 'screen fragments revealed');
  const fragmentsTotal = positiveInt(row.fragmentsTotal, 'screen fragments total');
  if (fragmentsRevealed > fragmentsTotal) throw new Error('Unexpected mission six screen fragment counts');

  return {
    contractVersion: 2,
    status: row.status,
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    title: text(row.title, 'screen title'),
    fragmentsRevealed,
    fragmentsTotal,
    wagons: row.wagons.map((entry) => {
      const wagon = obj(entry, 'screen wagon');
      return {
        wagonId: text(wagon.wagonId, 'wagon id'),
        label: text(wagon.label, 'wagon label'),
        consensusReady: bool(wagon.consensusReady, 'consensus ready'),
      };
    }),
  };
}

export async function getGuestMissionSixReadModel(
  client: MissionSixRpcClient,
  eventSlug: string,
  deviceKey: string,
) {
  const { data, error } = await client.rpc('get_guest_bunker_v2_m06', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Mission six read failed');
  return parseMissionSixGuestReadModel(data);
}

export async function getMissionSixScreenReadModel(
  client: MissionSixRpcClient,
  eventSlug: string,
) {
  const { data, error } = await client.rpc('get_bunker_v2_m06_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Mission six screen failed');
  return parseMissionSixScreenReadModel(data);
}

export async function getOwnerMissionSixReadModel(
  client: MissionSixRpcClient,
  eventId: string,
) {
  const { data, error } = await client.rpc('get_owner_bunker_v2_m06', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Mission six owner failed');
  return parseMissionSixScreenReadModel(data);
}

export function revealMissionSixFragment(
  client: MissionSixRpcClient,
  input: {
    eventSlug: string;
    deviceKey: string;
    commandId: string;
    instanceId: string;
    fragmentKey: string;
  },
): Promise<BunkerCommandReceipt> {
  if (!input.fragmentKey.trim()) return Promise.reject(new Error('Mission six fragment key is required'));
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'reveal_fragment',
    payload: { instanceId: input.instanceId, fragmentKey: input.fragmentKey },
  });
}

export function castMissionSixVote(
  client: MissionSixRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; vote: Vote },
): Promise<BunkerCommandReceipt> {
  if (input.vote !== 'A' && input.vote !== 'B' && input.vote !== 'C') {
    return Promise.reject(new Error('Mission six vote must be A, B or C'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'cast_vote',
    payload: { instanceId: input.instanceId, vote: input.vote },
  });
}

export function useMissionSixAbility(
  client: MissionSixRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string },
): Promise<BunkerCommandReceipt> {
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'use_ability',
    payload: { instanceId: input.instanceId, problemKey: 'protocol' },
  });
}
