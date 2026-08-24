import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
  it('shows every registered participant before the draw is finalized', () => {
    const preDraw: ActiveProjection = {
      ...state,
      state: 'registration',
      activeCount: 2,
      players: players.slice(0, 2).map((player) => ({ ...player, seed: null })),
      matches: [],
    };

    render(<PublicBracket state={preDraw} />);

    expect(screen.getByRole('list', { name: 'Участники турнира' })).toBeInTheDocument();
    expect(screen.getByText('Игрок 1')).toBeInTheDocument();
    expect(screen.getByText('Игрок 2')).toBeInTheDocument();
  });

  it('renders two players as one final fight card with both names', () => {
    const twoPlayers: ActiveProjection = {
      ...state,
      activeCount: 2,
      players: players.slice(0, 2),
      matches: [
        match({
          id: 'final-1',
          matchKey: 'final-1',
          round: 'final',
          position: 1,
          player1GuestId: 'g1',
          player2GuestId: 'g2',
          status: 'ready',
        }),
      ],
    };

    const { container } = render(<PublicBracket state={twoPlayers} />);

    expect(container.querySelectorAll('.mk-bracket-match')).toHaveLength(1);
    expect(screen.getByText('Игрок 1')).toBeInTheDocument();
    expect(screen.getByText('Игрок 2')).toBeInTheDocument();
  });

  it('renders only real fights and hides bye/empty internal matches', () => {
    render(<PublicBracket state={state} />);

    expect(screen.getAllByText('Игрок 8').length).toBeGreaterThan(0);
    expect(screen.getByText('Игрок 9')).toBeInTheDocument();
    expect(screen.queryByText('Игрок 5')).not.toBeInTheDocument();
  });

  it('omits round columns without any real fight', () => {
    render(<PublicBracket state={state} />);

    expect(screen.getAllByText('1/8 ФИНАЛА')).toHaveLength(2);
    expect(screen.getAllByText('1/4 ФИНАЛА')).toHaveLength(2);
    expect(screen.queryByText('1/2 ФИНАЛА')).not.toBeInTheDocument();
    expect(screen.queryByText('ФИНАЛ')).not.toBeInTheDocument();
  });

  it('exposes visible rounds as semantic progressive navigation', async () => {
    const user = userEvent.setup();
    const progressiveState: ActiveProjection = {
      ...state,
      matches: [
        match({ id: 'm1', matchKey: 'r16-1', round: 'r16', position: 1, player1GuestId: 'g1', player2GuestId: 'g2', status: 'complete', winnerGuestId: 'g1' }),
        match({ id: 'm9', matchKey: 'qf-1', round: 'qf', position: 1, player1GuestId: 'g1', player2GuestId: 'g3', status: 'complete', winnerGuestId: 'g1' }),
        match({ id: 'm13', matchKey: 'sf-1', round: 'sf', position: 1, player1GuestId: 'g1', player2GuestId: 'g4', status: 'complete', winnerGuestId: 'g1' }),
        match({ id: 'm15', matchKey: 'final-1', round: 'final', position: 1, player1GuestId: 'g1', player2GuestId: 'g5', status: 'ready', current: true }),
      ],
    };

    render(<PublicBracket state={progressiveState} />);

    const navigation = screen.getByRole('navigation', { name: 'Этапы турнира' });
    const roundButtons = within(navigation).getAllByRole('button');
    expect(roundButtons.map((button) => button.textContent)).toEqual([
      '1/8 ФИНАЛА',
      '1/4 ФИНАЛА',
      '1/2 ФИНАЛА',
      'ФИНАЛ',
    ]);
    expect(roundButtons[3]).toHaveAttribute('aria-current', 'step');

    await user.click(roundButtons[2]);

    expect(roundButtons[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('region', { name: '1/2 ФИНАЛА' })).toHaveAttribute('data-active', 'true');
  });

  it('synchronizes the progressive navigation with the round snapped into view', () => {
    const progressiveState: ActiveProjection = {
      ...state,
      matches: [
        match({ id: 'm1', matchKey: 'r16-1', round: 'r16', position: 1, player1GuestId: 'g1', player2GuestId: 'g2', status: 'complete', winnerGuestId: 'g1' }),
        match({ id: 'm9', matchKey: 'qf-1', round: 'qf', position: 1, player1GuestId: 'g1', player2GuestId: 'g3', status: 'ready' }),
        match({ id: 'm13', matchKey: 'sf-1', round: 'sf', position: 1, player1GuestId: 'g1', player2GuestId: 'g4', status: 'ready' }),
      ],
    };
    render(<PublicBracket state={progressiveState} />);

    const roundViewport = screen.getByRole('group', { name: 'Турнирные раунды' });
    const navigation = screen.getByRole('navigation', { name: 'Этапы турнира' });
    const roundButtons = within(navigation).getAllByRole('button');
    const rounds = [
      screen.getByRole('region', { name: '1/8 ФИНАЛА' }),
      screen.getByRole('region', { name: '1/4 ФИНАЛА' }),
      screen.getByRole('region', { name: '1/2 ФИНАЛА' }),
    ];
    const rect = (left: number, width = 280): DOMRect => ({
      left,
      right: left + width,
      top: 0,
      bottom: 300,
      width,
      height: 300,
      x: left,
      y: 0,
      toJSON: () => ({}),
    });

    vi.spyOn(roundViewport, 'getBoundingClientRect').mockReturnValue(rect(0, 320));
    vi.spyOn(rounds[0], 'getBoundingClientRect').mockReturnValue(rect(-280));
    vi.spyOn(rounds[1], 'getBoundingClientRect').mockReturnValue(rect(20));
    vi.spyOn(rounds[2], 'getBoundingClientRect').mockReturnValue(rect(320));

    fireEvent.scroll(roundViewport);

    expect(roundButtons[1]).toHaveAttribute('aria-current', 'step');
    expect(rounds[1]).toHaveAttribute('data-active', 'true');
  });

  it('keeps long real participant names as primary bracket content', () => {
    const longNameState: ActiveProjection = {
      ...state,
      players: [
        ...players,
        {
          registrationId: 'r10',
          guestId: 'g10',
          displayName: 'Александра-Екатерина Константинопольская',
          seed: 10,
        },
      ],
      matches: [
        match({
          id: 'm4',
          matchKey: 'r16-4',
          round: 'r16',
          position: 4,
          player1GuestId: 'g10',
          player2GuestId: 'g2',
          status: 'ready',
        }),
      ],
    };

    render(<PublicBracket state={longNameState} />);

    expect(screen.getByText('Александра-Екатерина Константинопольская')).toBeInTheDocument();
  });

  it('shows only the deterministic round without navigation in projector mode', () => {
    const projected: ActiveProjection = {
      ...state,
      matches: [
        match({ id: 'm16', matchKey: 'r16-1', round: 'r16', position: 1, player1GuestId: 'g1', player2GuestId: 'g2', status: 'complete', winnerGuestId: 'g1' }),
        match({ id: 'mqf', matchKey: 'qf-1', round: 'qf', position: 1, player1GuestId: 'g1', player2GuestId: 'g3', status: 'ready' }),
      ],
    };

    render(<PublicBracket state={projected} displayMode="projector" />);

    expect(screen.queryByRole('navigation', { name: 'Этапы турнира' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '1/8 ФИНАЛА' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '1/4 ФИНАЛА' })).toBeInTheDocument();
  });
});

