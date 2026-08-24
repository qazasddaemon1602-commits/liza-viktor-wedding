import { render, screen } from '@testing-library/react';
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
    nextTicketSequence: 1,
  },
  state: null,
  carriages: [
    { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02', enabled: true },
    { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04', enabled: true },
  ],
  guests: [],
  recentActions: [],
};

function dependencies(overrides: Partial<AdminShellDependencies> = {}): AdminShellDependencies {
  return {
    load: vi.fn().mockResolvedValue(dashboard),
    deleteGuest: vi.fn().mockResolvedValue(undefined),
    reassignGuest: vi.fn().mockResolvedValue(undefined),
    lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
    ...overrides,
  };
}

describe('AdminShell carriage calls', () => {
  it('sends selected carriage calls through the owner dependency', async () => {
    const user = userEvent.setup();
    const sendCarriageCall = vi.fn().mockResolvedValue({
      callId: 'call-1',
      message: 'Готовимся к следующему конкурсу',
      targetCarriageIds: ['c2'],
      showOnScreen: false,
      createdAt: '2026-08-30T13:00:00+05:00',
    });
    render(
      <AdminShell
        dependencies={dependencies({
          sendCarriageCall,
          clearCarriageCall: vi.fn().mockResolvedValue(undefined),
        })}
      />,
    );

    await screen.findByText('Лиза × Виктор');
    await user.click(screen.getByLabelText('Выбрать ВАГОН №2'));
    await user.type(screen.getByLabelText('Сообщение вагонам'), 'Готовимся к следующему конкурсу');
    await user.click(screen.getByRole('button', { name: 'ОТПРАВИТЬ ВЫЗОВ' }));

    expect(sendCarriageCall).toHaveBeenCalledWith(
      ['c2'],
      'Готовимся к следующему конкурсу',
      false,
    );
    expect(await screen.findByText('ВЫЗОВ АКТИВЕН')).toBeInTheDocument();
  });

  it('publishes the carriage map for the current event through the owner dependency', async () => {
    const user = userEvent.setup();
    const showCarriageMap = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminShell
        dependencies={dependencies({
          sendCarriageCall: vi.fn(),
          clearCarriageCall: vi.fn().mockResolvedValue(undefined),
          showCarriageMap,
        })}
      />,
    );

    await screen.findByText('Лиза × Виктор');
    await user.click(screen.getByRole('button', { name: 'ПОКАЗАТЬ КАРТУ ВАГОНОВ НА ОБЩЕМ ЭКРАНЕ' }));

    expect(showCarriageMap).toHaveBeenCalledWith('event-1');
  });
});
