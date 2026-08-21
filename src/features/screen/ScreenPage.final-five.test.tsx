import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';

function quizResults() {
  return {
    status: 'active' as const,
    phase: 'results' as const,
    question: { id: 'f1', text: 'Кто главный?', imagePath: null },
    answeredCount: 30,
    results: { liza: 18, viktor: 12, total: 30 },
  };
}

it('switches from guest results to the staged final-five reveal after owner refresh', async () => {
  let refresh: (() => void) | undefined;
  const loadFinalFive = vi.fn()
    .mockResolvedValueOnce({ status: 'hidden' })
    .mockResolvedValue({
      status: 'revealed',
      question: { id: 'f1', text: 'Кто главный?' },
      results: { liza: 18, viktor: 12, total: 30 },
      lizaAnswer: 'liza',
      viktorAnswer: 'viktor',
    });
  const dependencies: ScreenPageDependencies = {
    subscribe: vi.fn(() => vi.fn()),
    loadQuiz: vi.fn().mockResolvedValue(quizResults()),
    loadCoupleAnswer: vi.fn().mockResolvedValue({ status: 'hidden' }),
    loadFinalFive,
    subscribeToQuizRefresh: vi.fn((callback) => {
      refresh = callback;
      return vi.fn();
    }),
  };

  render(<ScreenPage joinUrl="https://wedding.test/join" eventSlug="liza-viktor" dependencies={dependencies} />);

  expect(await screen.findByLabelText('Результаты голосования')).toBeInTheDocument();
  expect(screen.queryByText('ФИНАЛЬНАЯ ПЯТЁРКА')).not.toBeInTheDocument();

  act(() => refresh?.());

  expect(await screen.findByText('ФИНАЛЬНАЯ ПЯТЁРКА')).toBeInTheDocument();
  expect(screen.getByLabelText('Результаты гостей')).toBeInTheDocument();
  await waitFor(() => expect(loadFinalFive).toHaveBeenCalledTimes(2));
});

it('ignores a revealed final-five payload for another question', async () => {
  const dependencies: ScreenPageDependencies = {
    subscribe: vi.fn(() => vi.fn()),
    loadQuiz: vi.fn().mockResolvedValue(quizResults()),
    loadCoupleAnswer: vi.fn().mockResolvedValue({ status: 'hidden' }),
    loadFinalFive: vi.fn().mockResolvedValue({
      status: 'revealed',
      question: { id: 'old', text: 'Старый вопрос' },
      results: { liza: 10, viktor: 10, total: 20 },
      lizaAnswer: 'liza',
      viktorAnswer: 'liza',
    }),
    subscribeToQuizRefresh: vi.fn(() => vi.fn()),
  };

  render(<ScreenPage joinUrl="https://wedding.test/join" eventSlug="liza-viktor" dependencies={dependencies} />);

  expect(await screen.findByLabelText('Результаты голосования')).toBeInTheDocument();
  expect(screen.queryByText('ФИНАЛЬНАЯ ПЯТЁРКА')).not.toBeInTheDocument();
});
