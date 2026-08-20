import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MkMatch, MkPlayer, MkTournamentProjection } from './mk.types';
import { PublicBracket } from './PublicBracket';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

const players: MkPlayer[] = Array.from({ length: 9 }, (_, index) => ({
  registrationId: `r${index + 1}`,
  guestId: `g${index + 1}`,
  displayName: `Игрок ${index + 1}`,
  seed: index + 1,
}));

const match = (
  overrides: Partial<MkMatch> & Pick<MkMatch, 'id' | 'matchKey' | 'round' | 'position'>,
): MkMatch => ({
  player1GuestId: null,
  player2GuestId: null,
  winnerGuestId: null,
  status: 'pending',
  current: false,
  ...overrides,
});

const state: ActiveProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
  activeCount: 9,
  maxPlayers: 16,
  ownRegistrationStatus: null,
  waitlistPosition: null,
  players,
  matches: [
    match({ id: 'm1', matchKey: 'r16-1', round: 'r16', position: 1, player1GuestId: 'g1', winnerGuestId: 'g1', status: 'complete' }),
    match({ id: 'm2', matchKey: 'r16-2', round: 'r16', position: 2, player1GuestId: 'g8', player2GuestId: 'g9', status: 'ready', current: true }),
    match({ id: 'm3', matchKey: 'r16-3', round: 'r16', position: 3, player1GuestId: 'g5', winnerGuestId: 'g5', status: 'complete' }),
    match({ id: 'm9', matchKey: 'qf-1', round: 'qf', position: 1, player1GuestId: 'g1', player2GuestId: 'g8', status: 'ready' }),
    match({ id: 'm13', matchKey: 'sf-1', round: 'sf', position: 1 }),
    match({ id: 'm15', matchKey: 'final-1', round: 'final', position: 1 }),
  ],
  championGuestId: null,
  presentOnMainScreen: true,
};

describe('PublicBracket with byes', () => {
  it('renders only real fights and hides bye/empty internal matches', () => {
    render(<PublicBracket state={state} />);

    expect(screen.getAllByText('Игрок 8').length).toBeGreaterThan(0);
    expect(screen.getByText('Игрок 9')).toBeInTheDocument();
    expect(screen.queryByText('Игрок 5')).not.toBeInTheDocument();
  });

  it('omits round columns without any real fight', () => {
    render(<PublicBracket state={state} />);

    expect(screen.getByText('1/8 ФИНАЛА')).toBeInTheDocument();
    expect(screen.getByText('1/4 ФИНАЛА')).toBeInTheDocument();
    expect(screen.queryByText('1/2 ФИНАЛА')).not.toBeInTheDocument();
    expect(screen.queryByText('ФИНАЛ')).not.toBeInTheDocument();
  });
});
