import type { BracketMatch, MkRound } from './mk.types';

type MatchAddress = Pick<BracketMatch, 'round' | 'position'>;

type NextSlot = {
  matchKey: string;
  slot: 'player1' | 'player2';
};

const ROUND_SIZES: Array<{ round: MkRound; count: number }> = [
  { round: 'r16', count: 8 },
  { round: 'qf', count: 4 },
  { round: 'sf', count: 2 },
  { round: 'final', count: 1 },
];

export const SEED_SLOT_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15] as const;

export function buildBracket(playerIds: string[]): BracketMatch[] {
  if (playerIds.length < 2 || playerIds.length > 16) {
    throw new Error('Tournament bracket requires between 2 and 16 players');
  }
  if (new Set(playerIds).size !== playerIds.length || playerIds.some((playerId) => !playerId.trim())) {
    throw new Error('Tournament bracket requires unique player ids');
  }

  const bySeed = (seed: number): string | null => playerIds[seed - 1] ?? null;

  const matches: BracketMatch[] = [];
  for (const { round, count } of ROUND_SIZES) {
    for (let position = 1; position <= count; position += 1) {
      const slotIndex = (position - 1) * 2;
      matches.push({
        matchKey: `${round}-${position}`,
        round,
        position,
        player1GuestId: round === 'r16' ? bySeed(SEED_SLOT_ORDER[slotIndex]) : null,
        player2GuestId: round === 'r16' ? bySeed(SEED_SLOT_ORDER[slotIndex + 1]) : null,
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

