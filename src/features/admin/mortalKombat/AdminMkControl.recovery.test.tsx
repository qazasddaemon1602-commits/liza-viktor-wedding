import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MkOwnerControl } from '../../mortalKombat/mk.types';
import { AdminMkControl, type AdminMkControlDependencies } from './AdminMkControl';

const ready: MkOwnerControl = {
  status: 'owner', tournamentId: 't1', state: 'draw_ready', activeCount: 2,
  waitlistCount: 0, maxPlayers: 16, matches: [], championGuestId: null,
  registrations: [1, 2].map((seed) => ({
    registrationId: `r${seed}`, guestId: `g${seed}`, displayName: `Игрок ${seed}`,
    status: 'active' as const, seed, registeredAt: `2026-08-30T12:0${seed}:00Z`,
  })),
};

function deps(load: AdminMkControlDependencies['load']): AdminMkControlDependencies {
  return {
    load, open: vi.fn(), close: vi.fn(), randomize: vi.fn(), swap: vi.fn(), remove: vi.fn(),
    promote: vi.fn(), reset: vi.fn(), finalize: vi.fn(), setCurrent: vi.fn(),
    recordWinner: vi.fn(), undo: vi.fn(), broadcastRefresh: vi.fn().mockResolvedValue(undefined),
    pollIntervalMs: 100,
  };
}

describe('AdminMkControl recovery', () => {
  it('discovers new phone joins without an admin page reload', async () => {
    const joined: MkOwnerControl = {
      ...ready,
      activeCount: 3,
      registrations: [...ready.registrations, {
        registrationId: 'r3', guestId: 'g3', displayName: 'Новый Игрок', status: 'active', seed: 3,
        registeredAt: '2026-08-30T12:03:00Z',
      }],
    };
    const load = vi.fn().mockResolvedValueOnce(ready).mockResolvedValue(joined);
    render(<AdminMkControl eventId="event-1" dependencies={deps(load)} />);

    expect(await screen.findByText('2 / 16')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('3 / 16')).toBeInTheDocument(), { timeout: 600 });
    expect(screen.getByText('Новый Игрок')).toBeInTheDocument();
  });

  it('preserves the last owner snapshot and exposes stale status after refresh failure', async () => {
    const load = vi.fn().mockResolvedValueOnce(ready).mockRejectedValue(new Error('offline'));
    render(<AdminMkControl eventId="event-1" dependencies={deps(load)} />);
    expect(await screen.findByText('2 / 16')).toBeInTheDocument();
    expect(await screen.findByText('СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ', {}, { timeout: 600 })).toBeInTheDocument();
    expect(screen.getByText('2 / 16')).toBeInTheDocument();
  });
});
