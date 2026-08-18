import { act, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';

function quizResults() {
  return {
    status: 'active' as const,
    phase: 'results' as const,
    question: {
      id: 'question-1',
      text: 'Кто в доме главный?',
      imagePath: null,
    },
    answeredCount: 12,
    results: { liza: 7, viktor: 5, total: 12 },
  };
}

async function expectGuestResultsVisible() {
  const results = await screen.findByLabelText('Результаты голосования');
  expect(within(results).getByText('ЛИЗА')).toBeInTheDocument();
  expect(within(results).getByText('58%')).toBeInTheDocument();
  expect(within(results).getByText('ВИКТОР')).toBeInTheDocument();
  expect(within(results).getByText('42%')).toBeInTheDocument();
}

describe('ScreenPage joint answer reveal', () => {
  it('keeps guest results visible while the joint answer is still hidden', async () => {
    const dependencies: ScreenPageDependencies = {
      subscribe: vi.fn(() => vi.fn()),
      loadQuiz: vi.fn().mockResolvedValue(quizResults()),
      loadCoupleAnswer: vi.fn().mockResolvedValue({ status: 'hidden' }),
      subscribeToQuizRefresh: vi.fn(() => vi.fn()),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.test/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );

    await expectGuestResultsVisible();
    expect(screen.queryByText('ОТВЕТ ЛИЗЫ И ВИКТОРА')).not.toBeInTheDocument();
  });

  it('switches to the joint-answer scene after the same quiz realtime refresh', async () => {
    let refresh: (() => void) | undefined;
    const loadCoupleAnswer = vi.fn()
      .mockResolvedValueOnce({ status: 'hidden' })
      .mockResolvedValue({ status: 'revealed', questionId: 'question-1', choice: 'liza' });
    const dependencies: ScreenPageDependencies = {
      subscribe: vi.fn(() => vi.fn()),
      loadQuiz: vi.fn().mockResolvedValue(quizResults()),
      loadCoupleAnswer,
      subscribeToQuizRefresh: vi.fn((callback) => {
        refresh = callback;
        return vi.fn();
      }),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.test/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );

    await expectGuestResultsVisible();
    expect(screen.queryByText('ОТВЕТ ЛИЗЫ И ВИКТОРА')).not.toBeInTheDocument();

    act(() => refresh?.());

    expect(await screen.findByText('ОТВЕТ ЛИЗЫ И ВИКТОРА')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ЛИЗА' })).toBeInTheDocument();
    expect(screen.getByText('ГОСТИ УГАДАЛИ')).toBeInTheDocument();
    await waitFor(() => expect(loadCoupleAnswer).toHaveBeenCalledTimes(2));
  });

  it('ignores a revealed answer that belongs to another question', async () => {
    const dependencies: ScreenPageDependencies = {
      subscribe: vi.fn(() => vi.fn()),
      loadQuiz: vi.fn().mockResolvedValue(quizResults()),
      loadCoupleAnswer: vi.fn().mockResolvedValue({
        status: 'revealed',
        questionId: 'question-old',
        choice: 'viktor',
      }),
      subscribeToQuizRefresh: vi.fn(() => vi.fn()),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.test/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );

    await expectGuestResultsVisible();
    expect(screen.queryByText('ОТВЕТ ЛИЗЫ И ВИКТОРА')).not.toBeInTheDocument();
  });
});
