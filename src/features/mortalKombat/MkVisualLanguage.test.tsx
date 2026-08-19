import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MkMatch, MkTournamentProjection } from './mk.types';
import { MkFightScene } from './MkFightScene';
import { PublicBracket } from './PublicBracket';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

const players = [
  { registrationId: 'r1', guestId: 'g1', displayName: 'АЛЕКСЕЙ', seed: 1 },
  { registrationId: 'r2', guestId: 'g2', displayName: 'МАКСИМ', seed: 2 },
];

const match: MkMatch = {
  id: 'm1',
  round: 'qf',
  position: 2,
  player1GuestId: 'g1',
  player2GuestId: 'g2',
  winnerGuestId: null,
  current: true,
};

const bracketState: ActiveProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'playing',
  activeCount: 16,
  maxPlayers: 16,
  ownRegistrationStatus: null,
  waitlistPosition: null,
  players,
  matches: [match],
  championGuestId: null,
  presentOnMainScreen: true,
};

describe('Mortal Kombat artbook visual language', () => {
  it('frames the current fight as an arena bout with editorial fighter labels', () => {
    render(<MkFightScene match={match} players={players} />);

    expect(screen.getByText('ARENA BOUT')).toBeInTheDocument();
    expect(screen.getByText('FIGHTER 01')).toBeInTheDocument();
    expect(screen.getByText('FIGHTER 02')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('presents the bracket as an arena board instead of a generic table', () => {
    render(<PublicBracket state={bracketState} />);

    expect(screen.getByText('ARENA BOARD')).toBeInTheDocument();
    expect(screen.getByText('LIVE BRACKET')).toBeInTheDocument();
    expect(screen.getByText('БОЙ 2')).toBeInTheDocument();
  });
});
