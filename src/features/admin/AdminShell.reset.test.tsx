import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from './AdminShell';
import type { AdminDashboard } from './admin.service';

const beforeReset: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-1',
    slug: 'liza-viktor',
    name: 'Лиза × Виктор',
    weddingDate: '2026-08-29',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: true,
    nextTicketSequence: 33,
  },
  state: {
    currentModule: 'premiere',
    screenMode: 'premiere_standby',
    screenPinned: true,
    updatedAt: '2026-08-30T12:00:00+05:00',
  },
  carriages: [
    { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#31483A', visualMark: '01', enabled: true },
  ],
  guests: [
    {
      id: 'g1',
      firstName: 'Тест',
      lastName: 'Гость',
      affiliationType: 'common',
      affiliationDetail: '',
      ticketNumber: 'LV-032',
      registeredAt: '2026-08-30T12:00:00+05:00',
      lastSeenAt: '2026-08-30T12:00:00+05:00',
      carriage: { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#31483A', visualMark: '01' },
    },
  ],
  recentActions: [],
};

const afterReset: AdminDashboard = {
  ...beforeReset,
  event: {
    ...beforeReset.event,
    registrationOpen: true,
    compositionLocked: false,
    nextTicketSequence: 1,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: '2026-08-30T12:10:00+05:00',
  },
  guests: [],
};

function baseDependencies(overrides: Partial<AdminShellDependencies> = {}): AdminShellDependencies {
  return {
    load: vi.fn().mockResolvedValue(structuredClone(beforeReset)),
    deleteGuest: vi.fn().mockResolvedValue(undefined),
    reassignGuest: vi.fn().mockResolvedValue(undefined),
    lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
    ...overrides,
  };
}

describe('AdminShell rehearsal reset', () => {
  it('refreshes the whole dashboard after a guarded reset', async () => {
    const user = userEvent.setup();
    const load = vi.fn()
      .mockResolvedValueOnce(structuredClone(beforeReset))
      .mockResolvedValueOnce(structuredClone(afterReset));
    const resetEventTestData = vi.fn().mockResolvedValue({
      deletedGuests: 1,
      preservedCoupleAnswers: 30,
      premiereConfigured: true,
      mortalKombatReset: true,
      bunkerReset: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });

    render(
      <AdminShell
        dependencies={baseDependencies({
          load,
          resetEventTestData,
        })}
      />,
    );

    await screen.findByText('Тест Гость');
    await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ТЕСТОВЫЕ ДАННЫЕ' }));
    await user.type(screen.getByLabelText('Введите СБРОСИТЬ'), 'СБРОСИТЬ');
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ СБРОС' }));

    expect(resetEventTestData).toHaveBeenCalledWith('event-1', 'СБРОСИТЬ');
    expect(load).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/0 \/ ~40/)).toBeInTheDocument();
    expect(screen.queryByText('Тест Гость')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПРИНЯТЬ РАСПРЕДЕЛЕНИЕ' })).toBeInTheDocument();
    expect(screen.getByText(/регистрация открыта/i)).toBeInTheDocument();
  });

  it('reports a completed reset even when the follow-up dashboard refresh is temporarily unavailable', async () => {
    const user = userEvent.setup();
    const load = vi.fn()
      .mockResolvedValueOnce(structuredClone(beforeReset))
      .mockRejectedValueOnce(new Error('temporary network failure'));
    const resetEventTestData = vi.fn().mockResolvedValue({
      deletedGuests: 1,
      preservedCoupleAnswers: 30,
      premiereConfigured: true,
      mortalKombatReset: true,
      bunkerReset: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });

    render(
      <AdminShell
        dependencies={baseDependencies({ load, resetEventTestData })}
        refreshIntervalMs={0}
      />,
    );

    await screen.findByText('Тест Гость');
    await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ТЕСТОВЫЕ ДАННЫЕ' }));
    await user.type(screen.getByLabelText('Введите СБРОСИТЬ'), 'СБРОСИТЬ');
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ СБРОС' }));

    expect(await screen.findByText(/СБРОШЕНО · удалено гостей: 1/i)).toBeInTheDocument();
    expect(screen.getByText('СВЯЗЬ С АДМИНКОЙ · ПЕРЕПОДКЛЮЧЕНИЕ')).toBeInTheDocument();
    expect(screen.queryByText(/ничего не повторяйте вслепую/i)).not.toBeInTheDocument();
  });

  it('expires the owner session after a committed reset when the follow-up load returns 401', async () => {
    const user = userEvent.setup();
    const expired = Object.assign(new Error('jwt expired'), { status: 401 });
    const load = vi.fn()
      .mockResolvedValueOnce(structuredClone(beforeReset))
      .mockRejectedValueOnce(expired);
    const onSessionExpired = vi.fn();
    const resetEventTestData = vi.fn().mockResolvedValue({
      deletedGuests: 1, preservedCoupleAnswers: 30, premiereConfigured: true,
      mortalKombatReset: true, bunkerReset: true, registrationOpen: true, nextTicketSequence: 1,
    });

    render(<AdminShell dependencies={baseDependencies({ load, resetEventTestData, onSessionExpired })} refreshIntervalMs={0} />);
    await screen.findByText('Тест Гость');
    await user.click(screen.getByRole('button', { name: 'СБРОСИТЬ ТЕСТОВЫЕ ДАННЫЕ' }));
    await user.type(screen.getByLabelText('Введите СБРОСИТЬ'), 'СБРОСИТЬ');
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ СБРОС' }));

    expect(await screen.findByText(/СБРОШЕНО · удалено гостей: 1/i)).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
