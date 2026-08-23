import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MkOwnerControl } from '../../mortalKombat/mk.types';
import { AdminMkControl, type AdminMkControlDependencies } from './AdminMkControl';

const ready: MkOwnerControl = {
  status: 'owner',
  tournamentId: 't1',
  state: 'draw_ready',
  activeCount: 2,
  waitlistCount: 0,
  maxPlayers: 40,
  registrations: [
    {
      registrationId: 'r1',
      guestId: 'g1',
      displayName: 'Игрок 1',
      status: 'active',
      seed: 1,
      registeredAt: '2026-08-30T12:00:00.000Z',
    },
    {
      registrationId: 'r2',
      guestId: 'g2',
      displayName: 'Игрок 2',
      status: 'active',
      seed: 2,
      registeredAt: '2026-08-30T12:01:00.000Z',
    },
  ],
  matches: [],
  championGuestId: null,
};

const active: MkOwnerControl = {
  ...ready,
  state: 'active',
  matches: [
    {
      id: 'm1',
      matchKey: 'final-1',
      round: 'final',
      position: 1,
      player1GuestId: 'g1',
      player2GuestId: 'g2',
      winnerGuestId: null,
      status: 'ready',
      current: false,
    },
  ],
};

function deps(overrides: Partial<AdminMkControlDependencies> = {}): AdminMkControlDependencies {
  return {
    load: vi.fn().mockResolvedValue(ready),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    randomize: vi.fn().mockResolvedValue(undefined),
    swap: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    promote: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
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

describe('AdminMkControl committed-command resilience', () => {
  it('reloads authoritative state even when realtime broadcast fails after tournament start', async () => {
    const user = userEvent.setup();
    const load = vi.fn()
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(active);
    const broadcastRefresh = vi.fn().mockRejectedValue(new Error('realtime unavailable'));
    const finalize = vi.fn().mockResolvedValue(undefined);
    const setMainScreen = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminMkControl
        eventId="event-1"
        dependencies={deps({ load, broadcastRefresh, finalize, setMainScreen })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ЗАПУСТИТЬ ТУРНИР · 2 ИГРОКОВ' }));

    expect(finalize).toHaveBeenCalledWith('event-1');
    expect(setMainScreen).toHaveBeenCalledWith('event-1', true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('СЕТКА ЗАФИКСИРОВАНА')).toBeInTheDocument();
    expect(screen.queryByText(/Команда турнира не выполнена/i)).not.toBeInTheDocument();
  });
});
