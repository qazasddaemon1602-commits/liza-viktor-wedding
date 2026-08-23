import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from '../mortalKombat/mk.types';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';

const live: Extract<MkTournamentProjection, { status: 'active' }> = {
  status: 'active', tournamentId: 't1', state: 'active', activeCount: 2, maxPlayers: 16,
  ownRegistrationStatus: null, waitlistPosition: null, championGuestId: null, presentOnMainScreen: true,
  players: [
    { registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', seed: 1 },
    { registrationId: 'r2', guestId: 'g2', displayName: 'Максим', seed: 2 },
  ],
  matches: [{
    id: 'm1', matchKey: 'final-1', round: 'final', position: 1,
    player1GuestId: 'g1', player2GuestId: 'g2', winnerGuestId: null, status: 'ready', current: true,
  }],
};

describe('ScreenPage Mortal Kombat recovery', () => {
  it('polls the shared winner-only scene and keeps the latest valid fight during failure', async () => {
    const updated = { ...live, players: [{ ...live.players[0], displayName: 'Сергей Петров' }, live.players[1]] };
    const loadMortalKombat = vi.fn()
      .mockResolvedValueOnce(live)
      .mockResolvedValueOnce(updated)
      .mockRejectedValue(new Error('offline'));
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadMortalKombat,
      mkPollIntervalMs: 100,
    };
    render(<ScreenPage joinUrl="https://wedding.test/join" dependencies={dependencies} />);

    expect(await screen.findByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Сергей Петров' })).toBeInTheDocument(), { timeout: 600 });
    expect(await screen.findByText('СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ', {}, { timeout: 700 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сергей Петров' })).toBeInTheDocument();
  });
});
