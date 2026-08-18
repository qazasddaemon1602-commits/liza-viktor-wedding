import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MkMatch, MkOwnerRegistration } from '../../mortalKombat/mk.types';
import { MatchEditor } from './MatchEditor';

const registrations: MkOwnerRegistration[] = [
  { registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', status: 'active', seed: 1, registeredAt: '2026-08-30T12:00:00Z' },
  { registrationId: 'r2', guestId: 'g2', displayName: 'Максим', status: 'active', seed: 2, registeredAt: '2026-08-30T12:00:00Z' },
];

const currentMatch: MkMatch = {
  id: 'm1',
  matchKey: 'r16-1',
  round: 'r16',
  position: 1,
  player1GuestId: 'g1',
  player2GuestId: 'g2',
  winnerGuestId: null,
  status: 'ready',
  current: true,
};

describe('MatchEditor', () => {
  it('asks for destructive confirmation when changing a result would invalidate downstream matches', async () => {
    const user = userEvent.setup();
    const recordWinner = vi.fn()
      .mockResolvedValueOnce({
        status: 'impact',
        matchId: 'm1',
        affectedMatches: [{ matchId: 'qf1', matchKey: 'qf-1', round: 'qf', position: 1 }],
      })
      .mockResolvedValueOnce({
        status: 'recorded',
        matchId: 'm1',
        winnerGuestId: 'g1',
        affectedMatches: [],
      });

    render(
      <MatchEditor
        matches={[currentMatch]}
        registrations={registrations}
        onSetCurrent={vi.fn().mockResolvedValue(undefined)}
        onRecordWinner={recordWinner}
        onUndo={vi.fn()}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'ПОБЕДИЛ · Сергей' }));

    expect(recordWinner).toHaveBeenCalledWith('m1', 'g1', false);
    expect(screen.getByText('1/4 ФИНАЛА · БОЙ 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ЗАТРОНУТЫЕ РЕЗУЛЬТАТЫ' }));

    expect(recordWinner).toHaveBeenLastCalledWith('m1', 'g1', true);
  });
});