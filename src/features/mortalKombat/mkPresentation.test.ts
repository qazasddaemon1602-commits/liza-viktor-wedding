import { describe, expect, it } from 'vitest';
import type { MkMatch } from './mk.types';
import { countCompletedRealMkBouts, deriveMkProjectorRound, findCurrentReadyMkBout } from './mkPresentation';

const bout = (id: string, round: MkMatch['round'], status: MkMatch['status'], extra: Partial<MkMatch> = {}): MkMatch => ({
  id, matchKey: id, round, position: 1, player1GuestId: 'g1', player2GuestId: 'g2', winnerGuestId: null, status, current: false, ...extra,
});

describe('MK projector presentation derivation', () => {
  it('uses only a real ready current bout and otherwise picks deterministic round fallbacks', () => {
    const fakeCurrent = bout('fake', 'final', 'pending', { current: true, player2GuestId: null });
    const ready = bout('ready', 'qf', 'ready');
    expect(findCurrentReadyMkBout([fakeCurrent, ready])).toBeNull();
    expect(deriveMkProjectorRound([fakeCurrent, ready])).toBe('qf');
    expect(deriveMkProjectorRound([bout('old', 'r16', 'complete'), bout('deep', 'sf', 'complete')])).toBe('sf');
    expect(deriveMkProjectorRound([bout('future', 'final', 'pending')])).toBe('final');
  });

  it('counts completed real bouts and excludes byes', () => {
    expect(countCompletedRealMkBouts([
      bout('one', 'r16', 'complete'),
      bout('bye', 'r16', 'complete', { player2GuestId: null }),
      bout('ready', 'qf', 'ready'),
    ])).toBe(1);
  });
});
