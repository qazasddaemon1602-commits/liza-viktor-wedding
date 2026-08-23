import {
  submitBunkerCommand,
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type MissionFiveRpcClient = BunkerV2RpcClient;
export type MissionFiveRoute = {
  key: 'A' | 'B';
  title: string;
  description: string;
  risk: string;
};
export type MissionFiveOutcome = {
  routeChoice: 'A' | 'B';
  routeBonusMinutes: number;
  trackDamage: number;
  powerInstability: number;
  sector04Found: boolean;
  tier: 'best' | 'medium' | 'poor' | 'safe';
  fallback?: boolean;
};
export type MissionFiveGuestReadModel =
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
      routes: MissionFiveRoute[];
      selectedVote: 'A' | 'B' | null;
      voteCounts: { A: number; B: number; total: number; required: number };
      ability: { available: boolean; key: string; label: string; hint: string } | null;
      outcome?: MissionFiveOutcome;
    };
export type MissionFiveScreenReadModel =
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
        votesA: number;
        votesB: number;
        required: number;
        routeChoice: 'A' | 'B' | null;
      }>;
    };
export type MissionFiveOwnerReadModel = MissionFiveScreenReadModel;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected mission five ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected mission five ${label}`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected mission five ${label}`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  const result = integer(value, label);
  if (result < 1) throw new Error(`Unexpected mission five ${label}`);
  return result;
}

function signedInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Unexpected mission five ${label}`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected mission five ${label}`);
  return value;
}

function timestamp(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected mission five timestamp');
  return result;
}

function parseRoute(value: unknown): MissionFiveRoute {
  const row = object(value, 'route');
  if (row.key !== 'A' && row.key !== 'B') throw new Error('Unexpected mission five route key');
  return {
    key: row.key,
    title: text(row.title, 'route title'),
    description: text(row.description, 'route description'),
    risk: text(row.risk, 'route risk'),
  };
}

function parseSelectedVote(value: unknown, label = 'selected vote'): 'A' | 'B' | null {
  if (value === null || value === undefined) return null;
  if (value !== 'A' && value !== 'B') throw new Error(`Unexpected mission five ${label}`);
  return value;
}

function parseOutcome(value: unknown): MissionFiveOutcome | undefined {
  if (value === undefined || value === null) return undefined;
  const row = object(value, 'outcome');
  if (row.routeChoice !== 'A' && row.routeChoice !== 'B') {
    throw new Error('Unexpected mission five outcome route choice');
  }
  if (row.tier !== 'best' && row.tier !== 'medium' && row.tier !== 'poor' && row.tier !== 'safe') {
    throw new Error('Unexpected mission five outcome tier');
  }
  if (row.fallback !== undefined && typeof row.fallback !== 'boolean') {
    throw new Error('Unexpected mission five fallback');
  }
  return {
    routeChoice: row.routeChoice,
    routeBonusMinutes: signedInteger(row.routeBonusMinutes, 'route bonus minutes'),
    trackDamage: integer(row.trackDamage, 'track damage'),
    powerInstability: integer(row.powerInstability, 'power instability'),
    sector04Found: boolean(row.sector04Found, 'sector discovery'),
    tier: row.tier,
    ...(typeof row.fallback === 'boolean' ? { fallback: row.fallback } : {}),
  };
}

function parseAbility(value: unknown) {
  if (value === null) return null;
  const ability = object(value, 'ability');
  return {
    available: boolean(ability.available, 'ability available'),
    key: text(ability.key, 'ability key'),
    label: text(ability.label, 'ability label'),
    hint: text(ability.hint, 'ability hint'),
  };
}

export function parseMissionFiveGuestReadModel(value: unknown): MissionFiveGuestReadModel {
  const row = object(value, 'read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission five read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: timestamp(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission five status');
  }
  if (!Array.isArray(row.routes) || row.routes.length !== 2) {
    throw new Error('Unexpected mission five routes');
  }

  const routes = row.routes.map(parseRoute);
  const routeKeys = new Set(routes.map((route) => route.key));
  if (routeKeys.size !== 2 || !routeKeys.has('A') || !routeKeys.has('B')) {
    throw new Error('Unexpected mission five route set');
  }

  const wagon = object(row.wagon, 'wagon');
  const counts = object(row.voteCounts, 'vote counts');
  const votesA = integer(counts.A, 'votes A');
  const votesB = integer(counts.B, 'votes B');
  const total = integer(counts.total, 'votes total');
  const required = positiveInteger(counts.required, 'required votes');
  if (votesA + votesB !== total) throw new Error('Unexpected mission five vote total');

  const outcome = parseOutcome(row.outcome);
  return {
    contractVersion: 2,
    status: row.status,
    serverNow: timestamp(row.serverNow),
    deadlineAt: timestamp(row.deadlineAt),
    instanceId: text(row.instanceId, 'instance'),
    instanceVersion: integer(row.instanceVersion, 'version'),
    title: text(row.title, 'title'),
    intro: text(row.intro, 'intro'),
    wagon: {
      number: positiveInteger(wagon.number, 'wagon number'),
      label: text(wagon.label, 'wagon label'),
    },
    routes,
    selectedVote: parseSelectedVote(row.selectedVote),
    voteCounts: { A: votesA, B: votesB, total, required },
    ability: parseAbility(row.ability),
    ...(outcome ? { outcome } : {}),
  };
}

export function parseMissionFiveScreenReadModel(value: unknown): MissionFiveScreenReadModel {
  const row = object(value, 'screen read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission five screen read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: timestamp(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission five screen status');
  }
  if (!Array.isArray(row.wagons)) throw new Error('Unexpected mission five screen wagons');

  return {
    contractVersion: 2,
    status: row.status,
    serverNow: timestamp(row.serverNow),
    deadlineAt: timestamp(row.deadlineAt),
    title: text(row.title, 'screen title'),
    wagons: row.wagons.map((entry) => {
      const wagon = object(entry, 'screen wagon');
      if (wagon.status !== 'active' && wagon.status !== 'completed') {
        throw new Error('Unexpected mission five wagon status');
      }
      const routeChoice = parseSelectedVote(wagon.routeChoice, 'route choice');
      return {
        wagonId: text(wagon.wagonId, 'wagon id'),
        label: text(wagon.label, 'wagon label'),
        status: wagon.status,
        votesA: integer(wagon.votesA, 'votes A'),
        votesB: integer(wagon.votesB, 'votes B'),
        required: positiveInteger(wagon.required, 'required votes'),
        routeChoice,
      };
    }),
  };
}

export async function getGuestMissionFiveReadModel(
  client: MissionFiveRpcClient,
  eventSlug: string,
  deviceKey: string,
) {
  const { data, error } = await client.rpc('get_guest_bunker_v2_m05', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Mission five read failed');
  return parseMissionFiveGuestReadModel(data);
}

export async function getMissionFiveScreenReadModel(
  client: MissionFiveRpcClient,
  eventSlug: string,
) {
  const { data, error } = await client.rpc('get_bunker_v2_m05_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Mission five screen failed');
  return parseMissionFiveScreenReadModel(data);
}

export async function getOwnerMissionFiveReadModel(
  client: MissionFiveRpcClient,
  eventId: string,
) {
  const { data, error } = await client.rpc('get_owner_bunker_v2_m05', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Mission five owner failed');
  return parseMissionFiveScreenReadModel(data);
}

export function castMissionFiveVote(
  client: MissionFiveRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; vote: 'A' | 'B' },
): Promise<BunkerCommandReceipt> {
  if (input.vote !== 'A' && input.vote !== 'B') {
    return Promise.reject(new Error('Mission five vote must be A or B'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'cast_vote',
    payload: { instanceId: input.instanceId, vote: input.vote },
  });
}

export function useMissionFiveAbility(
  client: MissionFiveRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string },
): Promise<BunkerCommandReceipt> {
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'use_ability',
    payload: { instanceId: input.instanceId, problemKey: 'route_choice' },
  });
}
