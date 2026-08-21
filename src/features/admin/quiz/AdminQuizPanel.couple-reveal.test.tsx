import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminQuizPanel, type AdminQuizPanelDependencies } from './AdminQuizPanel';

function resultControl() {
  return {
    status: 'ok' as const,
    phase: 'results' as const,
    currentQuestionId: 'question-1',
    answeredCount: 12,
    questions: [
      {
        id: 'question-1',
        text: 'Кто в доме главный?',
        questionType: 'standard' as const,
        sortOrder: 1,
        enabled: true,
        imagePath: null,
      },
    ],
    results: { liza: 7, viktor: 5, total: 12 },
  };
}

function baseDependencies(): AdminQuizPanelDependencies {
  return {
    load: vi.fn().mockResolvedValue(resultControl()),
    seed: vi.fn().mockResolvedValue({ status: 'existing', insertedCount: 0 }),
    activate: vi.fn().mockResolvedValue({ status: 'active', questionId: 'question-1', phase: 'voting' }),
    reveal: vi.fn().mockResolvedValue({
      status: 'revealed',
      questionId: 'question-1',
      results: { liza: 7, viktor: 5, total: 12 },
    }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AdminQuizPanel joint answer reveal', () => {
  it('shows the separate second reveal only after guest results and only when the joint answer is ready', async () => {
    const loadCoupleRevealStatus = vi.fn().mockResolvedValue({ status: 'ready', revealed: false });
    const revealCoupleAnswer = vi.fn().mockResolvedValue({ status: 'revealed', questionId: 'question-1' });
    const dependencies: AdminQuizPanelDependencies = {
      ...baseDependencies(),
      loadCoupleRevealStatus,
      revealCoupleAnswer,
    };

    render(<AdminQuizPanel eventId="event-1" dependencies={dependencies} />);

    const button = await screen.findByRole('button', { name: 'ПОКАЗАТЬ ОТВЕТ ЛИЗЫ И ВИКТОРА' });
    expect(loadCoupleRevealStatus).toHaveBeenCalledWith('event-1', 'question-1');
    expect(screen.getByText('ЛИЗА 58%')).toBeInTheDocument();
    expect(screen.queryByText(/ОТВЕТ ЛИЗЫ И ВИКТОРА: ЛИЗА/)).not.toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(revealCoupleAnswer).toHaveBeenCalledWith('event-1', 'question-1'));
    expect(dependencies.broadcastRefresh).toHaveBeenCalled();
    expect(await screen.findByText('ОТВЕТ ПАРЫ ПОКАЗАН')).toBeInTheDocument();
  });

  it('does not expose a second reveal button while the joint answer is not ready', async () => {
    const dependencies: AdminQuizPanelDependencies = {
      ...baseDependencies(),
      loadCoupleRevealStatus: vi.fn().mockResolvedValue({ status: 'not_ready', revealed: false }),
      revealCoupleAnswer: vi.fn(),
    };

    render(<AdminQuizPanel eventId="event-1" dependencies={dependencies} />);

    expect(await screen.findByText('ЛИЗА 58%')).toBeInTheDocument();
    await waitFor(() => expect(dependencies.loadCoupleRevealStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'ПОКАЗАТЬ ОТВЕТ ЛИЗЫ И ВИКТОРА' })).not.toBeInTheDocument();
  });
});
