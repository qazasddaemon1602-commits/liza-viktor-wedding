import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from './AdminShell';
import type { AdminDashboard } from './admin.service';

vi.mock('./mortalKombat/AdminMkControl', () => ({
  AdminMkControl: ({ eventId }: { eventId: string }) => <div>MK CONTROL · {eventId}</div>,
}));

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

describe('AdminShell Mortal Kombat integration', () => {
  it('renders the MK director control for the current event', async () => {
    const dependencies: AdminShellDependencies = {
      load: vi.fn().mockResolvedValue(dashboard),
      deleteGuest: vi.fn(),
      reassignGuest: vi.fn(),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
      mortalKombat: {
        load: vi.fn(), open: vi.fn(), close: vi.fn(), randomize: vi.fn(), swap: vi.fn(),
        remove: vi.fn(), promote: vi.fn(), finalize: vi.fn(), setCurrent: vi.fn(),
        reset: vi.fn(), recordWinner: vi.fn(), undo: vi.fn(), broadcastRefresh: vi.fn(),
      },
    };

    render(<AdminShell dependencies={dependencies} />);

    expect(await screen.findByText('MK CONTROL · event-1')).toBeInTheDocument();
  });
});
