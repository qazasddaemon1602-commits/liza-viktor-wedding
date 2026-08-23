import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkTournamentProjection } from './mk.types';
import { MkScreenPage, type MkScreenPageDependencies } from './MkScreenPage';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

const liveFight: ActiveProjection = {
  status: 'active',
  tournamentId: 't1',
  state: 'active',
  activeCount: 16,
  maxPlayers: 40,
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
  presentOnMainScreen: false,
};

const completed: ActiveProjection = {
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
  it('turns the pre-draw state into a full projector waiting composition', async () => {
    const registrationState: ActiveProjection = {
      ...liveFight,
      state: 'registration',
      activeCount: 9,
      matches: [],
    };

    render(<MkScreenPage dependencies={dependencies(registrationState)} />);

    const board = await screen.findByTestId('mk-projector-bracket');
    expect(board).toHaveClass('mk-public-bracket--projector', 'mk-public-bracket--waiting');
    expect(screen.getByText('9 / 40 БОЙЦОВ')).toBeInTheDocument();
    expect(screen.getByText('СЛЕДУЮЩЕЕ · ЖЕРЕБЬЁВКА')).toBeInTheDocument();
  });

  it('keeps a not-opened tournament visually filled instead of showing an empty black screen', async () => {
    render(<MkScreenPage dependencies={dependencies({ status: 'idle' })} />);

    expect(await screen.findByTestId('mk-projector-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('mk-projector-waiting-art')).toHaveAttribute(
      'src',
      '/images/tournament/arena-wide.png',
    );
    expect(screen.getByText('ЭКРАН ГОТОВ · ОЖИДАЕМ КОМАНДУ')).toBeInTheDocument();
  });

  it('shows a cinematic VS scene for the authoritative current fight', async () => {
    render(<MkScreenPage dependencies={dependencies(liveFight)} />);

    expect(await screen.findByText('ТЕКУЩИЙ БОЙ')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('mk-screen-page');
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Максим' })).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('shows the champion after the final result', async () => {
    render(<MkScreenPage dependencies={dependencies(completed)} />);

    expect(await screen.findByText('ПОСЛЕДНИЙ БОЙ ЗАВЕРШЁН')).toBeInTheDocument();
    expect(screen.getByText('ПОБЕДИТЕЛЬ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();
    expect(screen.queryByText(/FINISH HIM/i)).not.toBeInTheDocument();
  });

  it('keeps the authoritative fight visible while reconnecting and clears the status after recovery', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(liveFight)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ...liveFight,
        players: [
          { ...liveFight.players[0], displayName: 'Сергей Петров' },
          liveFight.players[1],
        ],
      });

    render(
      <MkScreenPage
        dependencies={{
          load,
          subscribeToRefresh: (callback) => {
            refresh = callback;
            return vi.fn();
          },
        }}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Сергей' })).toBeInTheDocument();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('status')).toHaveTextContent('СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ');
    expect(screen.getByRole('heading', { name: 'Сергей' })).toBeInTheDocument();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByRole('heading', { name: 'Сергей Петров' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

