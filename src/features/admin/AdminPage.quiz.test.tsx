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

describe('AdminPage quiz wiring', () => {
  it('passes owner quiz actions into the authenticated owner shell', async () => {
    const quizLoad = vi.fn().mockResolvedValue({
      status: 'ok',
      phase: 'voting',
      currentQuestionId: 'question-1',
      answeredCount: 9,
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
      quiz: {
        load: quizLoad,
        seed: vi.fn().mockResolvedValue({ status: 'existing', insertedCount: 0 }),
        activate: vi.fn().mockResolvedValue({ status: 'active', questionId: 'question-1', phase: 'voting' }),
        reveal: vi.fn().mockResolvedValue({
          status: 'revealed',
          questionId: 'question-1',
          results: { liza: 5, viktor: 4, total: 9 },
        }),
        broadcastRefresh: vi.fn().mockResolvedValue(undefined),
      },
    };

    render(<AdminPage dependencies={dependencies} />);

    expect(await screen.findByText('Кто в доме главный?')).toBeInTheDocument();
    expect(quizLoad).toHaveBeenCalledWith('event-1');
  });
});
