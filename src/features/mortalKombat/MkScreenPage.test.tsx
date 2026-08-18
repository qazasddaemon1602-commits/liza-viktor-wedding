import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from './mk.types';
import { MkScreenPage, type MkScreenPageDependencies } from './MkScreenPage';

const liveFight: MkTournamentProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
  activeCount: 16,
  maxPlayers: 16,
  ownRegistrationStatus: null,
  waitlistPosition: null,
  players: [
    { registrationId: 'r1', guestId: 'g1', displayName: 'Сергей', seed: 1 },
    { registrationId: 'r2', guestId: 'g2', displayName: 'Максим', seed: 2 },
  ],
  matches: [{
    id: 'm1', matchKey: 'r16-1', round: 'r16', position: 1,
    player1GuestId: 'g1', player2GuestId: 'g2', winnerGuestId: null,
    status: 'ready', current: true,
  }],
  championGuestId: null,
};

const completed: MkTournamentProjection = {
  ...liveFight,
  state: 'complete',
  championGuestId: 'g1',
  matches: [{ ...liveFight.matches[0], winnerGuestId: 'g1', status: 'complete', current: true }],
};

function dependencies(state: MkTournamentProjection): MkScreenPageDependencies {
  return {
    load: vi.fn().mockResolvedValue(state),
    subscribeToRefresh: () => vi.fn(),
  };
}

describe('MkScreenPage', () => {
  it('shows a cinematic VS scene for the authoritative current fight', async () => {
    render(<MkScreenPage dependencies={dependencies(liveFight)} />);

    expect(await screen.findByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Максим' })).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('shows the champion after the final result', async () => {
    render(<MkScreenPage dependencies={dependencies(completed)} />);

    expect(await screen.findByText('CHAMPION')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
  });
});