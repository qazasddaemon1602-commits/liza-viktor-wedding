import { render, screen } from '@testing-library/react';
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

describe('AdminPage couple preanswer wiring', () => {
  it('passes secure couple preparation actions into the authenticated owner shell', async () => {
    const loadStatus = vi.fn().mockResolvedValue({
      status: 'active',
      answeredCount: 21,
      totalCount: 30,
      issuedAt: '2026-08-18T10:00:00Z',
      finalizedAt: null,
    });
    const dependencies: AdminPageDependencies = {
      getSession: vi.fn().mockResolvedValue({ userId: 'owner-1' }),
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
      loadDashboard: vi.fn().mockResolvedValue(dashboard),
      deleteGuest: vi.fn().mockResolvedValue(undefined),
      reassignGuest: vi.fn().mockResolvedValue(undefined),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
      issueGuestRecovery: vi.fn().mockResolvedValue({ code: 'AB12-CD34', expiresAt: '2026-08-30T12:15:00+05:00' }),
      subscribeToRegistrations: vi.fn(() => vi.fn()),
      couplePreanswers: {
        load: loadStatus,
        issue: vi.fn().mockResolvedValue({ status: 'issued', token: 'secret-token' }),
        buildAccessUrl: (token) => `https://wedding.test/couple-preanswers?token=${token}`,
      },
    };

    render(<AdminPage dependencies={dependencies} />);

    expect(await screen.findByText('21 / 30 ОТВЕЧЕНО')).toBeInTheDocument();
    expect(loadStatus).toHaveBeenCalledWith('event-1');
  });
});
