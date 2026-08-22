import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminPage, type AdminPageDependencies } from './AdminPage';
import type { AdminDashboard } from './admin.service';
import type { AdminBunkerControlDependencies } from './bunker/AdminBunkerControl';

const dashboard: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-1',
    slug: 'liza-viktor',
    name: 'Лиза × Виктор',
    weddingDate: '2026-08-29',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: false,
    nextTicketSequence: 1,
  },
  state: null,
  carriages: [
    { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04', enabled: true },
  ],
  guests: [],
  recentActions: [],
};

const dashboardWithGuest: AdminDashboard = {
  ...dashboard,
  guests: [
    {
      id: 'g32',
      firstName: 'Анна',
      lastName: 'Смирнова',
      affiliationType: 'liza',
      affiliationDetail: 'подруга Лизы',
      ticketNumber: 'LV-032',
      registeredAt: '2026-08-30T12:06:00+05:00',
      lastSeenAt: '2026-08-30T12:06:00+05:00',
      carriage: { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
    },
  ],
};

function dependencies(overrides: Partial<AdminPageDependencies> = {}): AdminPageDependencies {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    loadDashboard: vi.fn().mockResolvedValue(dashboard),
    deleteGuest: vi.fn().mockResolvedValue(undefined),
    reassignGuest: vi.fn().mockResolvedValue(undefined),
    lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
    issueGuestRecovery: vi.fn().mockResolvedValue({ code: 'AB12-CD34', expiresAt: '2026-08-30T12:15:00+05:00' }),
    subscribeToRegistrations: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

function bunkerControlDependencies(): AdminBunkerControlDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'idle',
      durationSeconds: 1800,
      soundEnabled: true,
      serverNow: '2026-08-30T12:00:00.000Z',
    }),
    prepare: vi.fn().mockResolvedValue({
      status: 'prepared',
      eventId: 'event-1',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'LOBBY',
      gameMode: 'production',
      wagonCount: 4,
      guestCount: 32,
    }),
    distribute: vi.fn().mockResolvedValue({
      status: 'characters_ready',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY',
      assignedCount: 32,
      wagonCount: 4,
    }),
    start: vi.fn().mockResolvedValue({ status: 'active' }),
    stop: vi.fn().mockResolvedValue({ status: 'idle' }),
    setSound: vi.fn().mockResolvedValue({ status: 'updated' }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AdminPage', () => {
  it('shows owner login when there is no authenticated session', async () => {
    render(<AdminPage dependencies={dependencies()} />);

    expect(await screen.findByRole('button', { name: 'ВОЙТИ В АДМИНКУ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email владельца')).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
    expect(screen.queryByText(/создать аккаунт/i)).not.toBeInTheDocument();
  });

  it('signs in and opens the owner dashboard after Supabase returns the new owner session', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);
    const getSession = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ userId: 'owner-1' });
    const loadDashboard = vi.fn().mockResolvedValue(dashboard);
    const bunkerLoadDashboard = vi.fn().mockResolvedValue(dashboard);
    render(
      <AdminPage
        dependencies={dependencies({
          getSession,
          signIn,
          loadDashboard,
          bunkerDock: {
            loadDashboard: bunkerLoadDashboard,
            applyDistribution: vi.fn().mockResolvedValue(undefined),
            bunkerControl: bunkerControlDependencies(),
          },
        })}
      />,
    );

    await screen.findByRole('button', { name: 'ВОЙТИ В АДМИНКУ' });
    expect(bunkerLoadDashboard).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Email владельца'), 'ilya@example.test');
    await user.type(screen.getByLabelText('Пароль'), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'ВОЙТИ В АДМИНКУ' }));

    expect(signIn).toHaveBeenCalledWith('ilya@example.test', 'secret-password');
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Лиза × Виктор')).toBeInTheDocument();
    expect(loadDashboard).toHaveBeenCalled();
    expect(bunkerLoadDashboard).toHaveBeenCalled();
  });

  it('keeps private dashboard data hidden when an authenticated user is not the event owner', async () => {
    const forbidden = Object.assign(new Error('owner access required'), { code: '42501' });
    render(
      <AdminPage
        dependencies={dependencies({
          getSession: vi.fn().mockResolvedValue({ userId: 'someone-else' }),
          loadDashboard: vi.fn().mockRejectedValue(forbidden),
        })}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'АДМИНКА НЕДОСТУПНА' })).toBeInTheDocument();
    expect(screen.getByText(/проверьте связь и доступ владельца/i)).toBeInTheDocument();
    expect(screen.queryByText('Лиза × Виктор')).not.toBeInTheDocument();
  });

  it('passes the real registration subscription through to the owner shell', async () => {
    let realtimeCallback: ((guestId: string) => void) | undefined;
    const subscribeToRegistrations = vi.fn((callback: (guestId: string) => void) => {
      realtimeCallback = callback;
      return vi.fn();
    });
    const loadDashboard = vi.fn()
      .mockResolvedValueOnce(dashboard)
      .mockResolvedValueOnce(dashboardWithGuest);

    render(
      <AdminPage
        dependencies={dependencies({
          getSession: vi.fn().mockResolvedValue({ userId: 'owner-1' }),
          loadDashboard,
          subscribeToRegistrations,
        })}
      />,
    );

    await screen.findByText('Лиза × Виктор');
    await waitFor(() => expect(subscribeToRegistrations).toHaveBeenCalled());

    await act(async () => {
      realtimeCallback?.('g32');
      await Promise.resolve();
    });

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('НОВЫЙ ПАССАЖИР')).toBeInTheDocument();
  });

  it('passes the protected recovery-code action through to the owner shell', async () => {
    const user = userEvent.setup();
    const issueGuestRecovery = vi.fn().mockResolvedValue({
      code: 'AB12-CD34',
      expiresAt: '2026-08-30T12:15:00+05:00',
    });

    render(
      <AdminPage
        dependencies={dependencies({
          getSession: vi.fn().mockResolvedValue({ userId: 'owner-1' }),
          loadDashboard: vi.fn().mockResolvedValue(dashboardWithGuest),
          issueGuestRecovery,
        })}
      />,
    );

    await screen.findByText('Анна Смирнова');
    await user.click(screen.getByRole('button', { name: 'ВЫДАТЬ ДОСТУП ЗАНОВО Анна Смирнова' }));

    expect(issueGuestRecovery).toHaveBeenCalledWith('g32');
    expect(await screen.findByText('AB12-CD34')).toBeInTheDocument();
  });

  it('passes carriage call actions through to the owner shell', async () => {
    const user = userEvent.setup();
    const sendCarriageCall = vi.fn().mockResolvedValue({
      callId: 'call-4',
      message: 'ВАГОН 4 — НА MORTAL KOMBAT',
      targetCarriageIds: ['c4'],
      showOnScreen: false,
      createdAt: '2026-08-30T13:00:00+05:00',
    });
    const clearCarriageCall = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminPage
        dependencies={dependencies({
          getSession: vi.fn().mockResolvedValue({ userId: 'owner-1' }),
          sendCarriageCall,
          clearCarriageCall,
        })}
      />,
    );

    await screen.findByText('Лиза × Виктор');
    await user.click(screen.getByLabelText('Выбрать ВАГОН №4'));
    await user.type(screen.getByLabelText('Сообщение вагонам'), 'ВАГОН 4 — НА MORTAL KOMBAT');
    await user.click(screen.getByRole('button', { name: 'ОТПРАВИТЬ ВЫЗОВ' }));

    expect(sendCarriageCall).toHaveBeenCalledWith(['c4'], 'ВАГОН 4 — НА MORTAL KOMBAT', false);
    expect(await screen.findByText('ВЫЗОВ АКТИВЕН')).toBeInTheDocument();
  });
});

