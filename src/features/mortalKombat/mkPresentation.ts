import { MK_ROUNDS, type MkMatch, type MkRound } from './mk.types';

const isRealBout = (match: MkMatch) => Boolean(match.player1GuestId && match.player2GuestId);

export function findCurrentReadyMkBout(matches: MkMatch[]): MkMatch | null {
  return matches.find((match) => match.current && match.status === 'ready' && isRealBout(match)) ?? null;
}

export function deriveMkProjectorRound(matches: MkMatch[]): MkRound | null {
  const current = findCurrentReadyMkBout(matches);
  if (current) return current.round;

  for (const round of MK_ROUNDS) {
    if (matches.some((match) => match.round === round && match.status === 'ready' && isRealBout(match))) return round;
  }
  for (const round of [...MK_ROUNDS].reverse()) {
    if (matches.some((match) => match.round === round && match.status === 'complete' && isRealBout(match))) return round;
  }
  return MK_ROUNDS.find((round) => matches.some((match) => match.round === round && isRealBout(match))) ?? null;
}

export function countCompletedRealMkBouts(matches: MkMatch[]): number {
  return matches.filter((match) => match.status === 'complete' && isRealBout(match)).length;
}
