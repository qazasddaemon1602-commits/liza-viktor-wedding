import { throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';

export type BunkerV2ResultSummary = {
  contractVersion: 2;
  status: 'completed';
  serverNow: string;
  finishTimeSeconds: number;
  emergencyOpen: boolean;
  characters: { active: number; saved: number; excluded: number };
  archiveFound: number;
  resourcesRemaining: number;
  resourcesUsed: number;
  tradesCompleted: number;
  wrongAttempts: number;
  hintsUsed: number;
  skillsUsed: number;
  missionsCompleted: number;
  missionsTotal: number;
  coordinationScore: number;
};

export type BunkerV2ResultsReadModel =
  | { contractVersion: 2; status: 'idle' | 'not_found'; serverNow: string }
  | BunkerV2ResultSummary;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected Bunker results');
  return value as Record<string, unknown>;
}

function nonNegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('Unexpected Bunker results');
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Unexpected Bunker results');
  return value;
}

export function parseBunkerV2Results(value: unknown): BunkerV2ResultsReadModel {
  const row = record(value);
  if (row.contractVersion !== 2 || typeof row.status !== 'string') throw new Error('Unexpected Bunker results');
  if (row.status === 'idle' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: timestamp(row.serverNow) };
  }
  if (row.status !== 'completed') throw new Error('Unexpected Bunker results');
  const characters = record(row.characters);
  const coordinationScore = nonNegative(row.coordinationScore);
  if (coordinationScore > 100 || typeof row.emergencyOpen !== 'boolean') throw new Error('Unexpected Bunker results');
  const result: BunkerV2ResultSummary = {
    contractVersion: 2,
    status: 'completed',
    serverNow: timestamp(row.serverNow),
    finishTimeSeconds: nonNegative(row.finishTimeSeconds),
    emergencyOpen: row.emergencyOpen,
    characters: {
      active: nonNegative(characters.active),
      saved: nonNegative(characters.saved),
      excluded: nonNegative(characters.excluded),
    },
    archiveFound: nonNegative(row.archiveFound),
    resourcesRemaining: nonNegative(row.resourcesRemaining),
    resourcesUsed: nonNegative(row.resourcesUsed),
    tradesCompleted: nonNegative(row.tradesCompleted),
    wrongAttempts: nonNegative(row.wrongAttempts),
    hintsUsed: nonNegative(row.hintsUsed),
    skillsUsed: nonNegative(row.skillsUsed),
    missionsCompleted: nonNegative(row.missionsCompleted),
    missionsTotal: nonNegative(row.missionsTotal),
    coordinationScore,
  };
  if (result.missionsCompleted > result.missionsTotal) throw new Error('Unexpected Bunker results');
  return result;
}

export async function getBunkerV2Results(
  client: BunkerV2RpcClient,
  eventSlug: string,
): Promise<BunkerV2ResultsReadModel> {
  const { data, error } = await client.rpc('get_bunker_v2_results', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Bunker results request failed');
  return parseBunkerV2Results(data);
}
