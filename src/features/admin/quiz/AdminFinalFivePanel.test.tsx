import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminFinalFivePanel, type AdminFinalFivePanelDependencies } from './AdminFinalFivePanel';

const finalQuestion = {
  id: 'f1',
  text: 'Кто главный?',
  questionType: 'final_five' as const,
  sortOrder: 101,
  enabled: true,
  imagePath: null,
};

function deps(overrides: Partial<AdminFinalFivePanelDependencies> = {}): AdminFinalFivePanelDependencies {
  return {
    loadQuiz: vi.fn().mockResolvedValue({
      status: 'ok', phase: 'idle', currentQuestionId: null, answeredCount: 0,
      questions: [finalQuestion],
    }),
    seed: vi.fn().mockResolvedValue({ status: 'ready', questionCount: 5 }),
    issueRole: vi.fn().mockImplementation(async (_eventId, role) => ({ status: 'issued', role, token: `${role}-secret` })),
    buildRoleUrl: (role, token) => `https://wedding.test/${role}?token=${token}`,
    activate: vi.fn().mockResolvedValue({ status: 'active', questionId: 'f1', phase: 'voting' }),
    revealGuestResults: vi.fn().mockResolvedValue({ status: 'revealed', questionId: 'f1', results: { liza: 18, viktor: 12, total: 30 } }),
    loadStatus: vi.fn().mockResolvedValue({ status: 'ok', current: true, phase: 'voting', answeredCount: 18, lizaAnswered: true, viktorAnswered: false, revealed: false }),
    revealFinal: vi.fn().mockResolvedValue({ status: 'revealed', questionId: 'f1' }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AdminFinalFivePanel', () => {
  it('seeds the exact final five when the pool is missing', async () => {
    const loadQuiz = vi.fn()
      .mockResolvedValueOnce({ status: 'ok', phase: 'idle', currentQuestionId: null, answeredCount: 0, questions: [] })
      .mockResolvedValueOnce({ status: 'ok', phase: 'idle', currentQuestionId: null, answeredCount: 0, questions: [finalQuestion] });
    const seed = vi.fn().mockResolvedValue({ status: 'ready', questionCount: 5 });
    render(<AdminFinalFivePanel eventId="event-1" dependencies={deps({ loadQuiz, seed })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'ДОБАВИТЬ ФИНАЛЬНУЮ ПЯТЁРКУ' }));

    await waitFor(() => expect(seed).toHaveBeenCalledWith('event-1'));
    await waitFor(() => expect(loadQuiz).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Кто главный?')).toBeInTheDocument();
  });

  it('issues separate private links for Liza and Viktor without persisting plaintext in status', async () => {
    const issueRole = vi.fn().mockImplementation(async (_eventId, role) => ({ status: 'issued', role, token: `${role}-secret` }));
    render(<AdminFinalFivePanel eventId="event-1" dependencies={deps({ issueRole })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'ССЫЛКА ДЛЯ ЛИЗЫ' }));
    fireEvent.click(screen.getByRole('button', { name: 'ССЫЛКА ДЛЯ ВИКТОРА' }));

    await waitFor(() => expect(issueRole).toHaveBeenCalledWith('event-1', 'liza'));
    await waitFor(() => expect(issueRole).toHaveBeenCalledWith('event-1', 'viktor'));
    expect(await screen.findByDisplayValue('https://wedding.test/liza?token=liza-secret')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://wedding.test/viktor?token=viktor-secret')).toBeInTheDocument();
  });

  it('shows only completion flags while a final question is live', async () => {
    const loadQuiz = vi.fn().mockResolvedValue({
      status: 'ok', phase: 'voting', currentQuestionId: 'f1', answeredCount: 18,
      questions: [finalQuestion],
    });
    render(<AdminFinalFivePanel eventId="event-1" dependencies={deps({ loadQuiz })} />);

    expect(await screen.findByText('18 ГОСТЕЙ ОТВЕТИЛИ')).toBeInTheDocument();
    expect(screen.getByText('ЛИЗА ОТВЕТИЛА')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР · ЖДЁМ')).toBeInTheDocument();
    expect(screen.queryByText(/ЛИЗА ВЫБРАЛА|ВИКТОР ВЫБРАЛ/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ПОКАЗАТЬ РЕЗУЛЬТАТ ГОСТЕЙ' })).toBeEnabled();
  });

  it('allows the final reveal only after guest results and both private answers exist', async () => {
    const resultsControl = {
      status: 'ok' as const, phase: 'results' as const, currentQuestionId: 'f1', answeredCount: 30,
      questions: [finalQuestion], results: { liza: 18, viktor: 12, total: 30 },
    };
    const loadStatus = vi.fn().mockResolvedValue({
      status: 'ok', current: true, phase: 'results', answeredCount: 30,
      lizaAnswered: true, viktorAnswered: true, revealed: false,
    });
    const revealFinal = vi.fn().mockResolvedValue({ status: 'revealed', questionId: 'f1' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    render(<AdminFinalFivePanel eventId="event-1" dependencies={deps({
      loadQuiz: vi.fn().mockResolvedValue(resultsControl), loadStatus, revealFinal, broadcastRefresh,
    })} />);

    const button = await screen.findByRole('button', { name: 'ПОКАЗАТЬ ЛИЗУ И ВИКТОРА' });
    expect(screen.getByText('ЛИЗА 60%')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР 40%')).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(revealFinal).toHaveBeenCalledWith('event-1', 'f1'));
    expect(broadcastRefresh).toHaveBeenCalled();
    expect(await screen.findByText('ФИНАЛ РАСКРЫТ')).toBeInTheDocument();
  });
});
