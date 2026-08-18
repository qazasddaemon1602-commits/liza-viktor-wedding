import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MkOwnerControl } from '../../mortalKombat/mk.types';
import { AdminMkControl, type AdminMkControlDependencies } from './AdminMkControl';

const ready: MkOwnerControl = {
  status: 'owner',
  tournamentId: 't1',
  state: 'draw_ready',
  activeCount: 16,
  waitlistCount: 1,
  maxPlayers: 16,
  registrations: [
    ...Array.from({ length: 16 }, (_, index) => ({
      registrationId: `r${index + 1}`,
      guestId: `g${index + 1}`,
      displayName: `Игрок ${index + 1}`,
      status: 'active' as const,
      seed: index + 1,
      registeredAt: '2026-08-30T12:00:00.000Z',
    })),
    {
      registrationId: 'wait-1',
      guestId: 'wait-g1',
      displayName: 'Запасной Игрок',
      status: 'waitlist' as const,
      seed: null,
      registeredAt: '2026-08-30T12:10:00.000Z',
    },
  ],
  matches: [],
  championGuestId: null,
};

function dependencies(overrides: Partial<AdminMkControlDependencies> = {}): AdminMkControlDependencies {
  return {
    load: vi.fn().mockResolvedValue(ready),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    randomize: vi.fn().mockResolvedValue(undefined),
    swap: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    promote: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    setCurrent: vi.fn().mockResolvedValue(undefined),
    showBracket: vi.fn().mockResolvedValue(undefined),
    setMainScreen: vi.fn().mockResolvedValue(undefined),
    recordWinner: vi.fn().mockResolvedValue({ status: 'recorded', matchId: 'm1', affectedMatches: [] }),
    undo: vi.fn().mockResolvedValue({ status: 'undone', matchId: 'm1', affectedMatches: [] }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AdminMkControl', () => {
  it('shows all sixteen seed slots and the waitlist before bracket start', async () => {
    render(<AdminMkControl eventId="event-1" dependencies={dependencies()} />);

    expect(await screen.findByRole('heading', { name: 'MORTAL KOMBAT · ПУЛЬТ' })).toBeInTheDocument();
    expect(screen.getAllByTestId('seed-slot')).toHaveLength(16);
    expect(screen.getByText('Запасной Игрок')).toBeInTheDocument();
    expect(screen.getByText('16 / 16')).toBeInTheDocument();
  });

  it('randomizes the draw and starts the bracket on the shared projector', async () => {
    const user = userEvent.setup();
    const randomize = vi.fn().mockResolvedValue(undefined);
    const finalize = vi.fn().mockResolvedValue(undefined);
    const setMainScreen = vi.fn().mockResolvedValue(undefined);
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue(ready);

    render(
      <AdminMkControl
        eventId="event-1"
        dependencies={dependencies({ randomize, finalize, setMainScreen, broadcastRefresh, load })}
      />,
    );

    await screen.findByText('16 / 16');
    await user.click(screen.getByRole('button', { name: 'ПЕРЕМЕШАТЬ 16 ИГРОКОВ' }));
    expect(randomize).toHaveBeenCalledWith('event-1');
    expect(broadcastRefresh).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ТУРНИР' }));
    expect(finalize).toHaveBeenCalledWith('event-1');
    expect(setMainScreen).toHaveBeenCalledWith('event-1', true);
    expect(broadcastRefresh).toHaveBeenCalledTimes(2);
  });

  it('removes a no-show from the active sixteen so a waitlisted guest can be promoted before start', async () => {
    const user = userEvent.setup();
    const remove = vi.fn().mockResolvedValue(undefined);
    const promote = vi.fn().mockResolvedValue(undefined);
    const afterRemoval: MkOwnerControl = {
      ...ready,
      activeCount: 15,
      registrations: ready.registrations.map((registration) =>
        registration.registrationId === 'r1'
          ? { ...registration, status: 'withdrawn' as const, seed: null }
          : registration,
      ),
    };
    const afterPromotion: MkOwnerControl = {
      ...afterRemoval,
      activeCount: 16,
      waitlistCount: 0,
      registrations: afterRemoval.registrations.map((registration) =>
        registration.registrationId === 'wait-1'
          ? { ...registration, status: 'active' as const }
          : registration,
      ),
    };
    const load = vi.fn()
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(afterRemoval)
      .mockResolvedValueOnce(afterPromotion);

    render(
      <AdminMkControl
        eventId="event-1"
        dependencies={dependencies({ load, remove, promote })}
      />,
    );

    await screen.findByText('16 / 16');
    await user.click(screen.getByRole('button', { name: 'УБРАТЬ ИЗ СЕТКИ · Игрок 1' }));
    expect(remove).toHaveBeenCalledWith('r1');
    expect(await screen.findByText('15 / 16')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'В ОСНОВНУЮ СЕТКУ' }));
    expect(promote).toHaveBeenCalledWith('wait-1');
    expect(await screen.findByText('16 / 16')).toBeInTheDocument();
  });

  it('switches the live projector to the full bracket and can return it to the main wedding screen', async () => {
    const user = userEvent.setup();
    const activeState: MkOwnerControl = {
      ...ready,
      state: 'active',
      waitlistCount: 0,
    };
    const showBracket = vi.fn().mockResolvedValue(undefined);
    const setMainScreen = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue(activeState);

    render(
      <AdminMkControl
        eventId="event-1"
        dependencies={dependencies({ load, showBracket, setMainScreen })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ВЫВЕСТИ СЕТКУ НА ЭКРАНЫ' }));
    expect(showBracket).toHaveBeenCalledWith('event-1');
    expect(setMainScreen).toHaveBeenCalledWith('event-1', true);

    await user.click(screen.getByRole('button', { name: 'ВЕРНУТЬ ГЛАВНЫЙ ЭКРАН' }));
    expect(setMainScreen).toHaveBeenLastCalledWith('event-1', false);
  });
});
