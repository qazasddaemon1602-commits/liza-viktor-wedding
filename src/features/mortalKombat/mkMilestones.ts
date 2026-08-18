import type { MkTournamentProjection } from './mk.types';

export type MkMilestone = {
  key: string;
  eyebrow: string;
  title: string;
  detail: string;
  durationMs: number;
};

type ActiveMkState = Extract<MkTournamentProjection, { status: 'active' }>;

function completedCount(state: ActiveMkState, round: 'r16' | 'qf' | 'sf' | 'final'): number {
  return state.matches.filter((match) => match.round === round && match.status === 'complete').length;
}

function playerName(state: ActiveMkState, guestId: string | null): string | null {
  if (!guestId) return null;
  return state.players.find((player) => player.guestId === guestId)?.displayName ?? null;
}

export function deriveMkMilestone(
  previous: MkTournamentProjection | null,
  current: MkTournamentProjection,
): MkMilestone | null {
  if (current.status !== 'active') return null;
  const before = previous?.status === 'active' ? previous : null;

  if (current.state === 'registration') {
    for (const threshold of [16, 12, 8] as const) {
      const previousCount = before?.activeCount ?? 0;
      if (previousCount < threshold && current.activeCount >= threshold) {
        return {
          key: `players-${threshold}`,
          eyebrow: 'MORTAL KOMBAT · НАБОР ИГРОКОВ',
          title: `${threshold} / 16 ИГРОКОВ`,
          detail: threshold === 16 ? 'ОСНОВНАЯ СЕТКА СОБРАНА' : 'АРЕНА ЗАПОЛНЯЕТСЯ',
          durationMs: threshold === 16 ? 5200 : 3800,
        };
      }
    }
  }

  if (current.state === 'active' && before?.state !== 'active') {
    return {
      key: 'draw-locked',
      eyebrow: 'MORTAL KOMBAT',
      title: 'СЕТКА ЗАФИКСИРОВАНА',
      detail: '16 ИГРОКОВ · 15 БОЁВ · ОДИН ЧЕМПИОН',
      durationMs: 5200,
    };
  }

  if (before && current.state === 'active') {
    const previousCompleted = before.matches.filter((match) => match.status === 'complete').length;
    const currentCompleted = current.matches.filter((match) => match.status === 'complete').length;
    if (currentCompleted > previousCompleted) {
      const newlyCompleted = current.matches.find((match) =>
        match.status === 'complete'
        && before.matches.find((old) => old.id === match.id)?.status !== 'complete',
      );
      const winner = playerName(current, newlyCompleted?.winnerGuestId ?? null);
      if (winner) {
        return {
          key: `winner-${newlyCompleted?.id ?? currentCompleted}`,
          eyebrow: 'ПОБЕДИТЕЛЬ БОЯ',
          title: winner.toUpperCase(),
          detail: 'FATALITY · ДВИГАЕТСЯ ДАЛЬШЕ',
          durationMs: 3600,
        };
      }
    }

    if (completedCount(before, 'qf') < 4 && completedCount(current, 'qf') === 4) {
      return {
        key: 'semifinalists',
        eyebrow: 'MORTAL KOMBAT',
        title: 'ПОЛУФИНАЛИСТЫ ОПРЕДЕЛЕНЫ',
        detail: 'ОСТАЛОСЬ ЧЕТВЕРО',
        durationMs: 4600,
      };
    }

    if (completedCount(before, 'sf') < 2 && completedCount(current, 'sf') === 2) {
      return {
        key: 'finalists',
        eyebrow: 'MORTAL KOMBAT',
        title: 'ФИНАЛИСТЫ ОПРЕДЕЛЕНЫ',
        detail: 'ПОСЛЕДНИЙ БОЙ',
        durationMs: 5200,
      };
    }
  }

  return null;
}
