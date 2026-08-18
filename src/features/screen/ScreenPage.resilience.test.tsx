import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QuizScreenState } from '../quiz/quizScreen.service';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';

const results: QuizScreenState = {
  status: 'active',
  phase: 'results',
  question: {
    id: 'question-1',
    text: 'Кто в доме главный?',
    questionType: 'standard',
    imagePath: null,
  },
  answeredCount: 30,
  results: { liza: 12, viktor: 18, total: 30 },
};

describe('ScreenPage temporary network resilience', () => {
  it('keeps the last revealed couple answer when a refresh request temporarily fails', async () => {
    let refreshQuiz: (() => void) | undefined;
    const loadQuiz = vi.fn().mockResolvedValue(results);
    const loadCoupleAnswer = vi.fn()
      .mockResolvedValueOnce({ status: 'revealed', questionId: 'question-1', choice: 'viktor' })
      .mockRejectedValueOnce(new Error('temporary network loss'));
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz,
      loadCoupleAnswer,
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('ОНИ ВЫБРАЛИ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ВИКТОР' })).toBeInTheDocument();

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('ОНИ ВЫБРАЛИ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ВИКТОР' })).toBeInTheDocument();
  });

  it('shows a discreet reconnect state and refetches authoritative state when the browser comes back online', async () => {
    const loadQuiz = vi.fn().mockResolvedValue(results);
    const loadPremiere = vi.fn().mockResolvedValue({
      status: 'idle',
      serverNow: '2026-08-30T12:00:00.000Z',
    });
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz,
      loadPremiere,
      subscribeToQuizRefresh: () => vi.fn(),
      subscribeToPremiereRefresh: () => vi.fn(),
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const initialQuizCalls = loadQuiz.mock.calls.length;
    const initialPremiereCalls = loadPremiere.mock.calls.length;

    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByText('СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Кто в доме главный?' })).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadQuiz.mock.calls.length).toBeGreaterThan(initialQuizCalls);
    expect(loadPremiere.mock.calls.length).toBeGreaterThan(initialPremiereCalls);
    expect(screen.queryByText('СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ')).not.toBeInTheDocument();
  });
});