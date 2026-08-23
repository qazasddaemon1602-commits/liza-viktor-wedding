import { useEffect } from 'react';
import type { MkTournamentProjection } from './mk.types';

type Options = {
  state: MkTournamentProjection | null;
  topVisible: boolean;
  playTournamentGong?: () => void;
};

const fallbackPlayed = new Set<string>();

export function useMkChampionGong({ state, topVisible, playTournamentGong }: Options) {
  useEffect(() => {
    if (state?.status !== 'active' || state.state !== 'complete' || !state.championGuestId || !topVisible) return;
    const key = `mk:gong:${state.tournamentId}:${state.championGuestId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      if (fallbackPlayed.has(key)) return;
      fallbackPlayed.add(key);
    }
    try {
      playTournamentGong?.();
    } catch {
      // Presentation remains usable when an audio backend rejects playback.
    }
  }, [playTournamentGong, state, topVisible]);
}
