import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from './AdminShell';
import type { AdminDashboard } from './admin.service';

const dashboard: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-1', slug: 'liza-viktor', name: 'Лиза × Виктор',
    weddingDate: '2026-08-29', eventDate: '2026-08-30', expectedGuestCount: 40,
    registrationOpen: true, compositionLocked: false, nextTicketSequence: 1,
  },
  state: null,
  carriages: [],
  guests: [],
  recentActions: [],
};

it('renders the dedicated final-five owner panel for the current event', async () => {
  const loadQuiz = vi.fn().mockResolvedValue({
    status: 'ok', phase: 'idle', currentQuestionId: null, answeredCount: 0,
    questions: [{ id: 'f1', text: 'Кто главный?', questionType: 'final_five', sortOrder: 101, enabled: true, imagePath: null }],
  });
  const dependencies: AdminShellDependencies = {
    load: vi.fn().mockResolvedValue(dashboard),
    deleteGuest: vi.fn(),
    reassignGuest: vi.fn(),
    lockComposition: vi.fn(),
    finalFive: {
      loadQuiz,
      seed: vi.fn(),
      issueRole: vi.fn(),
      buildRoleUrl: (role, token) => `https://wedding.test/${role}?token=${token}`,
      activate: vi.fn(),
      revealGuestResults: vi.fn(),
      loadStatus: vi.fn().mockResolvedValue({ status: 'not_ready' }),
      revealFinal: vi.fn(),
      broadcastRefresh: vi.fn(),
    },
  };

  render(<AdminShell dependencies={dependencies} />);

  expect(await screen.findByText('Кто главный?')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'ФИНАЛЬНАЯ ПЯТЁРКА' })).toBeInTheDocument();
  expect(loadQuiz).toHaveBeenCalledWith('event-1');
});
