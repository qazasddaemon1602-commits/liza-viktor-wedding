import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from './mk.types';
import { MkScreenPage } from './MkScreenPage';

const live: Extract<MkTournamentProjection, { status: 'active' }> = {
  status: 'active', tournamentId: 't1', state: 'active', activeCount: 2, maxPlayers: 16,
  ownRegistrationStatus: null, waitlistPosition: null, championGuestId: null, presentOnMainScreen: false,
  players: [
    { registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', seed: 1 },
    { registrationId: 'r2', guestId: 'g2', displayName: 'Максим', seed: 2 },
  ],
  matches: [{
    id: 'm1', matchKey: 'final-1', round: 'final', position: 1,
    player1GuestId: 'g1', player2GuestId: 'g2', winnerGuestId: null, status: 'ready', current: true,
  }],
};

describe('MkScreenPage recovery', () => {
  it('converges a missed realtime update through the injected poll cadence', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(live)
      .mockResolvedValue({ ...live, players: [{ ...live.players[0], displayName: 'Сергей Петров' }, live.players[1]] });
    render(<MkScreenPage dependencies={{ load, pollIntervalMs: 100 }} />);

    expect(await screen.findByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Сергей Петров' })).toBeInTheDocument(), { timeout: 600 });
  });

  it('keeps the last valid fight visible with a stale indicator after a failed poll', async () => {
    const load = vi.fn().mockResolvedValueOnce(live).mockRejectedValue(new Error('offline'));
    render(<MkScreenPage dependencies={{ load, pollIntervalMs: 100 }} />);

    expect(await screen.findByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    expect(await screen.findByText('СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ', {}, { timeout: 600 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
  });
});
