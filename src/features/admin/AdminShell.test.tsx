import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from './AdminShell';
import type { AdminDashboard } from './admin.service';

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
    nextTicketSequence: 33,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: '2026-08-30T12:00:00+05:00',
  },
  carriages: [
    { id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03', enabled: true },
    { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04', enabled: true },
  ],
  guests: [
    {
      id: 'g31',
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'viktor',
      affiliationDetail: 'коллега Виктора',
      ticketNumber: 'LV-031',
      registeredAt: '2026-08-30T12:01:00+05:00',
      lastSeenAt: '2026-08-30T12:05:00+05:00',
      carriage: { id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03' },
    },
  ],
  recentActions: [],
};

const newGuest = {
  id: 'g32',
  firstName: 'Анна',
  lastName: 'Смирнова',
  affiliationType: 'liza',
  affiliationDetail: 'подруга Лизы',
  ticketNumber: 'LV-032',
  registeredAt: '2026-08-30T12:06:00+05:00',
  lastSeenAt: '2026-08-30T12:06:00+05:00',
  carriage: { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
};

function dependencies(overrides: Partial<AdminShellDependencies> = {}): AdminShellDependencies {
  return {
    load: vi.fn().mockResolvedValue(structuredClone(dashboard)),
    deleteGuest: vi.fn().mockResolvedValue(undefined),
    reassignGuest: vi.fn().mockResolvedValue(undefined),
    lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
    issueGuestRecovery: vi.fn().mockResolvedValue({ code: 'AB12-CD34', expiresAt: '2026-08-30T12:15:00+05:00' }),
    ...overrides,
  };
}

describe('AdminShell', () => {
  it('loads the owner dashboard and renders private guest administration', async () => {
    const deps = dependencies();
    render(<AdminShell dependencies={deps} />);

    expect(await screen.findByText('Лиза × Виктор')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'РЕПЕТИЦИЯ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ОТКРЫТЬ ТВ' })).toHaveAttribute('href', '/screen');
    expect(screen.getByRole('link', { name: 'РЕГИСТРАЦИЯ ГОСТЯ' })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: 'КВИЗ' })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('link', { name: 'MK' })).toHaveAttribute('href', '/mortal-kombat');
    expect(screen.getByRole('link', { name: 'MK НА ТВ' })).toHaveAttribute('href', '/mortal-kombat/screen');
    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText(/зарегистрировано: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/регистрация открыта/i)).toBeInTheDocument();
  });

  it('fixes the current carriage composition without closing late registration', async () => {
    const user = userEvent.setup();
    const lockComposition = vi.fn().mockResolvedValue({ registrationOpen: true });
    render(<AdminShell dependencies={dependencies({ lockComposition })} />);

    await screen.findByText('Иван Петров');
    await user.click(screen.getByRole('button', { name: 'ЗАФИКСИРОВАТЬ СОСТАВ' }));

    expect(lockComposition).toHaveBeenCalledWith('event-1');
    expect(await screen.findByText('СОСТАВ ЗАФИКСИРОВАН')).toBeInTheDocument();
    expect(screen.getByText(/регистрация открыта/i)).toBeInTheDocument();
  });

  it('removes a deleted duplicate from the visible guest list after owner confirmation', async () => {
    const user = userEvent.setup();
    const deleteGuest = vi.fn().mockResolvedValue(undefined);
    render(<AdminShell dependencies={dependencies({ deleteGuest })} />);

    await screen.findByText('Иван Петров');
    await user.click(screen.getByRole('button', { name: 'УДАЛИТЬ Иван Петров' }));
    await user.click(screen.getByRole('button', { name: 'ДА, УДАЛИТЬ' }));

    expect(deleteGuest).toHaveBeenCalledWith('g31');
    expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument();
    expect(screen.getByText(/зарегистрировано: 0/i)).toBeInTheDocument();
  });

  it('updates the visible carriage after an explicit owner reassignment', async () => {
    const user = userEvent.setup();
    const reassignGuest = vi.fn().mockResolvedValue(undefined);
    render(<AdminShell dependencies={dependencies({ reassignGuest })} />);

    await screen.findByText('Иван Петров');
    const carriageSelect = screen.getByLabelText('Вагон Иван Петров');
    await user.selectOptions(carriageSelect, 'c4');

    expect(reassignGuest).toHaveBeenCalledWith('g31', 'c4');
    expect(carriageSelect).toHaveValue('c4');
  });

  it('issues a recovery code from the real owner guest list', async () => {
    const user = userEvent.setup();
    const issueGuestRecovery = vi.fn().mockResolvedValue({
      code: 'AB12-CD34',
      expiresAt: '2026-08-30T12:15:00+05:00',
    });
    render(<AdminShell dependencies={dependencies({ issueGuestRecovery })} />);

    await screen.findByText('Иван Петров');
    await user.click(screen.getByRole('button', { name: 'ВЫДАТЬ ДОСТУП ЗАНОВО Иван Петров' }));

    expect(issueGuestRecovery).toHaveBeenCalledWith('g31');
    expect(await screen.findByText('AB12-CD34')).toBeInTheDocument();
  });

  it('refreshes the guest list and shows an owner toast after realtime registration', async () => {
    let realtimeCallback: ((guestId: string) => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce(structuredClone(dashboard))
      .mockResolvedValueOnce({ ...structuredClone(dashboard), guests: [...dashboard.guests, newGuest] });
    const subscribeToRegistrations = vi.fn((callback: (guestId: string) => void) => {
      realtimeCallback = callback;
      return vi.fn();
    });

    render(
      <AdminShell
        dependencies={dependencies({
          load,
          subscribeToRegistrations,
        })}
      />,
    );

    await screen.findByText('Иван Петров');
    await act(async () => {
      realtimeCallback?.('g32');
      await Promise.resolve();
    });

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('НОВЫЙ ПАССАЖИР')).toBeInTheDocument();
    expect(screen.getAllByText('ВАГОН №4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Со стороны Лизы').length).toBeGreaterThan(0);
  });

  it('recovers a registration missed during realtime subscription by background polling', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(structuredClone(dashboard))
      .mockResolvedValue({ ...structuredClone(dashboard), guests: [...dashboard.guests, newGuest] });

    render(
      <AdminShell
        dependencies={dependencies({ load })}
        refreshIntervalMs={15}
      />,
    );

    await screen.findByText('Иван Петров');
    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Анна Смирнова', level: 3 })).toBeInTheDocument(),
      { timeout: 500 },
    );
    expect(screen.getByText('НОВЫЙ ПАССАЖИР')).toBeInTheDocument();
  });

  it('keeps the last valid owner dashboard visible during a temporary background refresh failure', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(structuredClone(dashboard))
      .mockRejectedValue(new Error('temporary network failure'));

    render(
      <AdminShell
        dependencies={dependencies({ load })}
        refreshIntervalMs={15}
      />,
    );

    await screen.findByText('Иван Петров');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('СВЯЗЬ С АДМИНКОЙ · ПЕРЕПОДКЛЮЧЕНИЕ'), { timeout: 500 });
    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'РЕПЕТИЦИЯ' })).toBeInTheDocument();
  });
});
