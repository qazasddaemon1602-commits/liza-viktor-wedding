import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminPage, type AdminPageDependencies } from './AdminPage';
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
  carriages: [],
  guests: [],
  recentActions: [],
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
    ...overrides,
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

  it('signs in and opens the owner dashboard', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);
    const loadDashboard = vi.fn().mockResolvedValue(dashboard);
    render(<AdminPage dependencies={dependencies({ signIn, loadDashboard })} />);

    await screen.findByRole('button', { name: 'ВОЙТИ В АДМИНКУ' });
    await user.type(screen.getByLabelText('Email владельца'), 'ilya@example.test');
    await user.type(screen.getByLabelText('Пароль'), 'secret-password');
    await user.click(screen.getByRole('button', { name: 'ВОЙТИ В АДМИНКУ' }));

    expect(signIn).toHaveBeenCalledWith('ilya@example.test', 'secret-password');
    expect(await screen.findByText('Лиза × Виктор')).toBeInTheDocument();
    expect(loadDashboard).toHaveBeenCalled();
  });

  it('shows access denied when an authenticated user is not the event owner', async () => {
    const forbidden = Object.assign(new Error('owner access required'), { code: '42501' });
    render(
      <AdminPage
        dependencies={dependencies({
          getSession: vi.fn().mockResolvedValue({ userId: 'someone-else' }),
          loadDashboard: vi.fn().mockRejectedValue(forbidden),
        })}
      />,
    );

    expect(await screen.findByText(/доступ запрещён/i)).toBeInTheDocument();
    expect(screen.queryByText('Лиза × Виктор')).not.toBeInTheDocument();
  });
});
