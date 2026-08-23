import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from './mk.types';
import { useMkChampionGong } from './useMkChampionGong';

const complete = {
  status: 'active', tournamentId: 't1', state: 'complete', activeCount: 2, maxPlayers: 16,
  ownRegistrationStatus: null, waitlistPosition: null, players: [], matches: [],
  championGuestId: 'g1', presentOnMainScreen: true,
} satisfies MkTournamentProjection;

describe('useMkChampionGong', () => {
  beforeEach(() => sessionStorage.clear());

  it('waits for top visibility and plays once per tournament champion session', () => {
    const play = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ topVisible }) => useMkChampionGong({ state: complete, topVisible, playTournamentGong: play }),
      { initialProps: { topVisible: false } },
    );
    expect(play).not.toHaveBeenCalled();
    act(() => rerender({ topVisible: true }));
    expect(play).toHaveBeenCalledTimes(1);
    unmount();
    renderHook(() => useMkChampionGong({ state: complete, topVisible: true, playTournamentGong: play }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('mk:gong:t1:g1')).toBe('1');
  });
});
