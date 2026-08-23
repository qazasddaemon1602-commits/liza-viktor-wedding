import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AdminDashboard } from '../admin.service';
import { EventHostRunbook } from './EventHostRunbook';

const dashboard: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-navigation',
    slug: 'liza-viktor',
    name: 'Лиза × Виктор',
    weddingDate: '2026-08-29',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: false,
    nextTicketSequence: 1,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: '2026-08-30T12:00:00+05:00',
  },
  carriages: [
    { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#315044', visualMark: '01', enabled: true },
    { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#7e3f3c', visualMark: '02', enabled: true },
  ],
  guests: [],
  recentActions: [],
};

beforeEach(() => window.localStorage.clear());

describe('EventHostRunbook manual stage navigation', () => {
  it('lets the host move forward and then back without changing server game state', async () => {
    const user = userEvent.setup();
    render(<EventHostRunbook dashboard={dashboard} />);

    const current = () => screen.getByRole('article', { name: 'Текущий этап сценария' });
    expect(current()).toHaveTextContent('ПРИБЫТИЕ ГОСТЕЙ');
    expect(screen.getByRole('button', { name: 'ПРЕДЫДУЩИЙ ЭТАП' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'СЛЕДУЮЩИЙ ЭТАП' }));
    expect(current()).toHaveTextContent('РЕГИСТРАЦИЯ И ПОСАДКА');
    expect(screen.getByRole('button', { name: 'ПРЕДЫДУЩИЙ ЭТАП' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'ПРЕДЫДУЩИЙ ЭТАП' }));
    expect(current()).toHaveTextContent('ПРИБЫТИЕ ГОСТЕЙ');
  });
});
