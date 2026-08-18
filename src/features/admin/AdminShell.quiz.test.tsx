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

describe('AdminShell quiz controls', () => {
  it('renders the live quiz panel with the current event id when quiz dependencies are available', async () => {
    const dependencies: AdminShellDependencies = {
      load: vi.fn().mockResolvedValue(dashboard),
      deleteGuest: vi.fn().mockResolvedValue(undefined),
      reassignGuest: vi.fn().mockResolvedValue(undefined),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
      quiz: {
        load: vi.fn().mockResolvedValue({
          status: 'ok',
          phase: 'voting',
          currentQuestionId: 'question-1',
          answeredCount: 12,
          questions: [
            {
              id: 'question-1',
              text: 'Кто в доме главный?',
              questionType: 'standard',
              sortOrder: 1,
              enabled: true,
              imagePath: null,
            },
          ],
        }),
        seed: vi.fn().mockResolvedValue({ status: 'existing', insertedCount: 0 }),
        activate: vi.fn().mockResolvedValue({ status: 'active', questionId: 'question-1', phase: 'voting' }),
        reveal: vi.fn().mockResolvedValue({
          status: 'revealed',
          questionId: 'question-1',
          results: { liza: 6, viktor: 6, total: 12 },
        }),
        broadcastRefresh: vi.fn().mockResolvedValue(undefined),
      },
    };

    render(<AdminShell dependencies={dependencies} />);

    expect(await screen.findByText('Кто в доме главный?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ЛИЗА ИЛИ ВИКТОР?' })).toBeInTheDocument();
    expect(dependencies.quiz?.load).toHaveBeenCalledWith('event-1');
  });
});
