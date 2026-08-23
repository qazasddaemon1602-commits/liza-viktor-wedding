import { describe, expect, it } from 'vitest';
import type { MkTournamentProjection } from './mk.types';
import { deriveMkMilestone } from './mkMilestones';

function state(activeCount: number): Extract<MkTournamentProjection, { status: 'active' }> {
  return {
    status: 'active',
    tournamentId: 't1',
    state: 'registration',
    activeCount,
    maxPlayers: 16,
    ownRegistrationStatus: null,
    waitlistPosition: null,
    players: [],
    matches: [],
    championGuestId: null,
    presentOnMainScreen: false,
  };
}

describe('deriveMkMilestone', () => {
  it('emits half, three-quarter and full-capacity beats only when crossing them', () => {
    expect(deriveMkMilestone(state(7), state(8))).toMatchObject({
      eyebrow: 'АРЕНА · НАБОР ИГРОКОВ',
      title: '8 / 16 ИГРОКОВ',
    });
    expect(deriveMkMilestone(state(11), state(12))?.title).toBe('12 / 16 ИГРОКОВ');
    expect(deriveMkMilestone(state(15), state(16))?.title).toBe('16 / 16 ИГРОКОВ');
    expect(deriveMkMilestone(state(12), state(12))).toBeNull();
  });

  it('announces the locked draw when the tournament becomes active', () => {
    const before = { ...state(16), state: 'draw_ready' as const };
    const current = { ...state(16), state: 'active' as const };

    expect(deriveMkMilestone(before, current)).toMatchObject({
      key: 'draw-locked',
      title: 'СЕТКА ЗАФИКСИРОВАНА',
    });
  });

  it('announces a newly recorded match winner using the public player snapshot', () => {
    const before = {
      ...state(16),
      state: 'active' as const,
      players: [{ registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', seed: 1 }],
      matches: [{
        id: 'm1', matchKey: 'r16-1', round: 'r16' as const, position: 1,
        player1GuestId: 'g1', player2GuestId: 'g2', winnerGuestId: null,
        status: 'ready' as const, current: true,
      }],
    };
    const current = {
      ...before,
      matches: [{ ...before.matches[0], winnerGuestId: 'g1', status: 'complete' as const, current: false }],
    };

    expect(deriveMkMilestone(before, current)).toMatchObject({
      eyebrow: 'ПОБЕДИТЕЛЬ БОЯ',
      title: 'СЕРГЕЙ',
      detail: 'ПРОХОДИТ В СЛЕДУЮЩИЙ КРУГ',
    });
  });

  it('never emits protected franchise copy into milestone scenes', () => {
    const draw = deriveMkMilestone(
      { ...state(16), state: 'draw_ready' },
      { ...state(16), state: 'active' },
    );
    expect(JSON.stringify(draw)).not.toMatch(/MORTAL KOMBAT|FATALITY/i);
  });
});

