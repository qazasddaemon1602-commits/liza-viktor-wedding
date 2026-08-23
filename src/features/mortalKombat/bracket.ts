import { MK_MAX_PLAYERS, MK_ROUNDS, type BracketMatch, type MkRound } from './mk.types';

type MatchAddress = Pick<BracketMatch, 'round' | 'position'>;

type NextSlot = {
  matchKey: string;
  slot: 'player1' | 'player2';
};

const ROUND_MATCH_COUNTS: Record<MkRound, number> = {
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
};

const FIRST_ROUND_BY_SIZE: Record<number, MkRound> = {
  2: 'final',
  4: 'sf',
  8: 'qf',
  16: 'r16',
};

function bracketSize(playerCount: number): number {
  let size = 2;
  while (size < playerCount) size *= 2;
  return size;
}

function seedSlotOrder(size: number): number[] {
  let order = size >= 16
    ? [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]
    : [1, 2];
  let currentSize = size >= 16 ? 16 : 2;
  while (currentSize < size) {
    const nextSize = currentSize * 2;
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
    currentSize = nextSize;
  }
  return order;
}

export const SEED_SLOT_ORDER = seedSlotOrder(16);

export function buildBracket(playerIds: string[]): BracketMatch[] {
  if (playerIds.length < 2 || playerIds.length > MK_MAX_PLAYERS) {
    throw new Error(`Tournament bracket requires between 2 and ${MK_MAX_PLAYERS} players`);
  }
  if (new Set(playerIds).size !== playerIds.length || playerIds.some((playerId) => !playerId.trim())) {
    throw new Error('Tournament bracket requires unique player ids');
  }

  const size = bracketSize(playerIds.length);
  const firstRound = FIRST_ROUND_BY_SIZE[size];
  const firstRoundIndex = MK_ROUNDS.indexOf(firstRound);
  const activeRounds = MK_ROUNDS.slice(firstRoundIndex);
  const slotOrder = seedSlotOrder(size);
  const bySeed = (seed: number): string | null => playerIds[seed - 1] ?? null;

  const matches: BracketMatch[] = [];
  for (const round of activeRounds) {
    const count = ROUND_MATCH_COUNTS[round];
    for (let position = 1; position <= count; position += 1) {
      const slotIndex = (position - 1) * 2;
      matches.push({
        matchKey: `${round}-${position}`,
        round,
        position,
        player1GuestId: round === firstRound ? bySeed(slotOrder[slotIndex]) : null,
        player2GuestId: round === firstRound ? bySeed(slotOrder[slotIndex + 1]) : null,
      });
    }
  }
  return matches;
}


export function nextMatchSlot(match: MatchAddress): NextSlot | null {
  if (match.position < 1) return null;

  const downstreamRound: Partial<Record<MkRound, MkRound>> = {
    r16: 'qf',
    qf: 'sf',
    sf: 'final',
  };
  const nextRound = downstreamRound[match.round];
  if (!nextRound) return null;

  const nextPosition = Math.ceil(match.position / 2);
  return {
    matchKey: `${nextRound}-${nextPosition}`,
    slot: match.position % 2 === 1 ? 'player1' : 'player2',
  };
}

export function affectedDownstreamMatches(
  matches: Array<Pick<BracketMatch, 'matchKey' | 'round' | 'position'>>,
  changedMatchKey: string,
): string[] {
  const byKey = new Map(matches.map((match) => [match.matchKey, match]));
  const affected: string[] = [];
  let current = byKey.get(changedMatchKey);

  while (current) {
    const downstream = nextMatchSlot(current);
    if (!downstream) break;
    const next = byKey.get(downstream.matchKey);
    if (!next) break;
    affected.push(next.matchKey);
    current = next;
  }

  return affected;
}

