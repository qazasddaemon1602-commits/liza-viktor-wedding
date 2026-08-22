import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { QuizScreenState } from '../quiz/quizScreen.service';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

const voting: QuizScreenState = {
  status: 'active',
  phase: 'voting',
  question: {
    id: 'question-1',
    text: 'Кто в доме главный?',
    questionType: 'standard',
    imagePath: null,
  },
  answeredCount: 17,
};

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
  results: { liza: 18, viktor: 12, total: 30 },
};

const arrival: ScreenPresentationEvent = {
  id: 'arrival-quiz-overlay',
  kind: 'guest_registered',
  createdAt: '2026-08-30T13:00:00+05:00',
  payload: {
    displayName: 'Анна Смирнова',
    carriage: {
      id: 'c4',
      number: 4,
      label: 'ВАГОН №4',
      accentHex: '#78806A',
      visualMark: '04',
    },
  },
};

describe('ScreenPage live quiz base scene', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('replaces the idle QR with the active quiz and reloads results on realtime refresh', async () => {
    let refreshQuiz: (() => void) | undefined;
    const loadQuiz = vi.fn()
      .mockResolvedValueOnce(voting)
      .mockResolvedValueOnce(results)
      .mockResolvedValueOnce({ status: 'idle' } satisfies QuizScreenState);
    const playQuizVotingSignal = vi.fn();
    const playQuizRevealSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz,
      playQuizVotingSignal,
      playQuizRevealSignal,
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Кто в доме главный?' })).toBeInTheDocument();
    expect(screen.getByText('17 / 40 ОТВЕТИЛИ')).toBeInTheDocument();
    expect(screen.queryByTestId('registration-qr')).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(playQuizRevealSignal).toHaveBeenCalledTimes(1);

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Кто в доме главный?' })).not.toBeInTheDocument();
  });

  it('temporarily overlays guest announcements and returns to the quiz instead of the QR screen', async () => {
    let pushScreenEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushScreenEvent = callback;
        return vi.fn();
      },
      loadQuiz: vi.fn().mockResolvedValue(voting),
      subscribeToQuizRefresh: () => vi.fn(),
      playArrivalSignal: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: 'Кто в доме главный?' })).toBeInTheDocument();

    act(() => pushScreenEvent?.(arrival));
    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('heading', { name: 'Анна Смирнова' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Кто в доме главный?' })).toBeInTheDocument();
    expect(screen.queryByTestId('registration-qr')).not.toBeInTheDocument();
  });
});
