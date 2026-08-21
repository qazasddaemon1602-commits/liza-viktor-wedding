import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MkMatch, MkTournamentProjection } from './mk.types';
import { ChampionScene } from './ChampionScene';
import { MkFightScene } from './MkFightScene';
import { MkMilestoneScene } from './MkMilestoneScene';
import { deriveMkMilestone } from './mkMilestones';
import { PublicBracket } from './PublicBracket';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

const players = [
  { registrationId: 'r1', guestId: 'g1', displayName: 'АЛЕКСЕЙ', seed: 1 },
  { registrationId: 'r2', guestId: 'g2', displayName: 'МАКСИМ', seed: 2 },
];

const match: MkMatch = {
  id: 'm1',
  matchKey: 'qf-2',
  round: 'qf',
  position: 2,
  player1GuestId: 'g1',
  player2GuestId: 'g2',
  winnerGuestId: null,
  status: 'ready',
  current: true,
};

const bracketState: ActiveProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
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

    const artwork = screen.getByTestId('tournament-fight-art');
    expect(artwork).toHaveAttribute('src', '/images/tournament/arena-fight-wide.png');
    expect(artwork).toHaveAttribute('width', '1672');
    expect(artwork).toHaveAttribute('height', '941');
    expect(artwork.closest('picture')?.querySelector('source[media="(max-width: 900px)"][type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/tournament/arena-fight-mobile-720.avif 720w, /images/tournament/arena-fight-mobile-1086.avif 1086w',
    );
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

  it('uses original archive copy instead of protected franchise slogans', () => {
    const { rerender } = render(<MkFightScene match={match} players={players} />);

    expect(screen.queryByText(/MORTAL KOMBAT/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FINISH HIM/i)).not.toBeInTheDocument();

    rerender(<ChampionScene championGuestId="g1" players={players} />);

    const championArtwork = screen.getByTestId('tournament-champion-art');
    expect(championArtwork).toHaveAttribute(
      'src',
      '/images/tournament/champion-hall.png',
    );
    expect(championArtwork).toHaveAttribute('width', '1672');
    expect(championArtwork).toHaveAttribute('height', '941');
    expect(championArtwork.closest('picture')?.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/tournament/champion-hall-960.avif 960w, /images/tournament/champion-hall-1672.avif 1672w',
    );
    expect(screen.getByText('ПОСЛЕДНИЙ БОЙ ЗАВЕРШЁН')).toBeInTheDocument();
    expect(screen.queryByText(/FINISH HIM/i)).not.toBeInTheDocument();
  });

  it('renders milestone copy from the original wedding arena vocabulary', () => {
    const previous: ActiveProjection = {
      ...bracketState,
      state: 'registration',
      activeCount: 7,
      matches: [],
    };
    const current: ActiveProjection = { ...previous, activeCount: 8 };
    const milestone = deriveMkMilestone(previous, current);
    if (!milestone) throw new Error('Expected a registration milestone');

    render(<MkMilestoneScene milestone={milestone} />);

    expect(screen.getByText('АРЕНА · НАБОР ИГРОКОВ')).toBeInTheDocument();
    expect(screen.queryByText(/MORTAL KOMBAT|FATALITY/i)).not.toBeInTheDocument();
  });
});

