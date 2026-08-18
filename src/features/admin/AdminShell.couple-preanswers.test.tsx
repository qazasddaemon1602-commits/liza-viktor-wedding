import { render, screen } from '@testing-library/react';
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
  carriages: [],
  guests: [],
  recentActions: [],
};

describe('AdminShell couple preanswers', () => {
  it('renders the secure couple preparation panel for the current event', async () => {
    const loadStatus = vi.fn().mockResolvedValue({
      status: 'active',
      answeredCount: 17,
      totalCount: 30,
      issuedAt: '2026-08-18T10:00:00Z',
      finalizedAt: null,
    });
    const dependencies: AdminShellDependencies = {
      load: vi.fn().mockResolvedValue(dashboard),
      deleteGuest: vi.fn().mockResolvedValue(undefined),
      reassignGuest: vi.fn().mockResolvedValue(undefined),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
      couplePreanswers: {
        load: loadStatus,
        issue: vi.fn().mockResolvedValue({ status: 'issued', token: 'secret-token' }),
        buildAccessUrl: (token) => `https://wedding.test/couple-preanswers?token=${token}`,
      },
    };

    render(<AdminShell dependencies={dependencies} />);

    expect(await screen.findByText('17 / 30 ОТВЕЧЕНО')).toBeInTheDocument();
    expect(loadStatus).toHaveBeenCalledWith('event-1');
  });
});
