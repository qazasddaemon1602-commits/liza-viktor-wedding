import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuestsPage, type AdminGuest } from './AdminGuestsPage';

const guests: AdminGuest[] = [
  {
    id: 'guest-31',
    firstName: 'Иван',
    lastName: 'Петров',
    affiliationType: 'viktor',
    affiliationDetail: 'коллега Виктора',
    ticketNumber: 'LV-031',
    registeredAt: '2026-08-30T15:12:00+05:00',
    carriage: { id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03' },
  },
  {
    id: 'guest-32',
    firstName: 'Анна',
    lastName: 'Смирнова',
    affiliationType: 'liza',
    affiliationDetail: 'подруга Лизы',
    ticketNumber: 'LV-032',
    registeredAt: '2026-08-30T15:14:00+05:00',
    carriage: { id: 'c1', number: 1, label: 'ВАГОН №1', accentHex: '#31483A', visualMark: '01' },
  },
];

describe('AdminGuestsPage', () => {
  it('shows owner-only registration details and carriage identity', () => {
    render(<AdminGuestsPage guests={guests} onDelete={vi.fn()} onReassign={vi.fn()} />);

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('коллега Виктора')).toBeInTheDocument();
    expect(screen.getByText('ВАГОН №3')).toBeInTheDocument();
    expect(screen.getByText('LV-031')).toBeInTheDocument();
    expect(screen.getByText(/зарегистрировано: 2/i)).toBeInTheDocument();
  });

  it('requires explicit confirmation before deleting a duplicate', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<AdminGuestsPage guests={guests} onDelete={onDelete} onReassign={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'УДАЛИТЬ Иван Петров' }));
    expect(screen.getByText(/удалить регистрацию ивана петрова/i)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ДА, УДАЛИТЬ' }));
    expect(onDelete).toHaveBeenCalledWith('guest-31');
  });

  it('filters guests by search without losing the total registration count', async () => {
    const user = userEvent.setup();
    render(<AdminGuestsPage guests={guests} onDelete={vi.fn()} onReassign={vi.fn()} />);

    await user.type(screen.getByLabelText('Поиск гостей'), 'Анна');
    expect(screen.getByText('Анна Смирнова')).toBeInTheDocument();
    expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument();
    expect(screen.getByText(/зарегистрировано: 2/i)).toBeInTheDocument();
  });
});
