import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { QuizScreenState } from '../quiz/quizScreen.service';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

const answeredText = (count: number) => `${count} / ${40} ОТВЕТИЛИ`;

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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

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
    expect(screen.getByText(answeredText(17))).toBeInTheDocument();
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

  it('does not replay a top-visible voting phase when its payload refreshes', async () => {
    let refreshQuiz: (() => void) | undefined;
    const playQuizVotingSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz: vi.fn()
        .mockResolvedValueOnce(voting)
        .mockResolvedValueOnce({ ...voting, answeredCount: 18 }),
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
      playQuizVotingSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(screen.getByTestId('quiz-screen-scene')).toBeInTheDocument();
    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(answeredText(18))).toBeInTheDocument();
    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);
  });

  it('plays the question-opening cue once audio becomes armed without replaying it on refresh', async () => {
    let refreshQuiz: (() => void) | undefined;
    let resolveAudioArm: ((armed: boolean) => void) | undefined;
    const audioArm = new Promise<boolean>((resolve) => {
      resolveAudioArm = resolve;
    });
    const playQuizVotingSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz: vi.fn()
        .mockResolvedValueOnce(voting)
        .mockResolvedValueOnce({ ...voting, answeredCount: 18 }),
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
      armArrivalAudio: vi.fn(() => audioArm),
      playQuizVotingSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(screen.getByTestId('quiz-screen-scene')).toBeInTheDocument();
    expect(playQuizVotingSignal).not.toHaveBeenCalled();

    await act(async () => {
      resolveAudioArm?.(true);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(answeredText(18))).toBeInTheDocument();
    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);
  });

  it('runs music and the final five countdown cues only while voting is visible on the projector', async () => {
    vi.setSystemTime('2026-08-30T13:00:00.000Z');
    let refreshQuiz: (() => void) | undefined;
    const startQuizMusic = vi.fn();
    const stopQuizMusic = vi.fn();
    const playQuizCountdownSignal = vi.fn();
    const playQuizRevealSignal = vi.fn();
    const timedVoting: QuizScreenState = {
      ...voting,
      phaseEndsAt: '2026-08-30T13:00:06.000Z',
    };
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz: vi.fn()
        .mockResolvedValueOnce(timedVoting)
        .mockResolvedValueOnce(results),
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
      startQuizMusic,
      stopQuizMusic,
      playQuizCountdownSignal,
      playQuizRevealSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(startQuizMusic).toHaveBeenCalledTimes(1);
    expect(playQuizCountdownSignal).not.toHaveBeenCalled();
    stopQuizMusic.mockClear();

    act(() => vi.advanceTimersByTime(1_000));
    expect(playQuizCountdownSignal).toHaveBeenCalledTimes(1);
    expect(playQuizCountdownSignal).toHaveBeenLastCalledWith(5);

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stopQuizMusic).toHaveBeenCalled();
    expect(playQuizRevealSignal).toHaveBeenCalledTimes(1);
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

  it('only presents and cues the latest quiz phase after a guest announcement finishes', async () => {
    let pushScreenEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    let refreshQuiz: (() => void) | undefined;
    const playQuizVotingSignal = vi.fn();
    const playQuizRevealSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushScreenEvent = callback;
        return vi.fn();
      },
      loadQuiz: vi.fn()
        .mockResolvedValueOnce(voting)
        .mockResolvedValueOnce(results),
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
      playArrivalSignal: vi.fn(),
      playQuizVotingSignal,
      playQuizRevealSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('quiz-screen-scene')).toBeInTheDocument();

    act(() => pushScreenEvent?.(arrival));
    expect(screen.queryByTestId('quiz-screen-scene')).not.toBeInTheDocument();

    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(playQuizRevealSignal).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('quiz-screen-scene')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(playQuizRevealSignal).toHaveBeenCalledTimes(1);
  });

  it('does not replay an unchanged quiz after it returns from an announcement', async () => {
    let pushScreenEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const playQuizVotingSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushScreenEvent = callback;
        return vi.fn();
      },
      loadQuiz: vi.fn().mockResolvedValue(voting),
      subscribeToQuizRefresh: () => vi.fn(),
      playArrivalSignal: vi.fn(),
      playQuizVotingSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    act(() => pushScreenEvent?.(arrival));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('quiz-screen-scene')).toBeInTheDocument();
    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);
  });

  it('keeps the projector on idle when a quiz closes during an announcement', async () => {
    let pushScreenEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    let refreshQuiz: (() => void) | undefined;
    const playQuizVotingSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushScreenEvent = callback;
        return vi.fn();
      },
      loadQuiz: vi.fn()
        .mockResolvedValueOnce(voting)
        .mockResolvedValueOnce({ status: 'idle' } satisfies QuizScreenState),
      subscribeToQuizRefresh: (callback) => {
        refreshQuiz = callback;
        return vi.fn();
      },
      playArrivalSignal: vi.fn(),
      playQuizVotingSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    act(() => pushScreenEvent?.(arrival));
    await act(async () => {
      refreshQuiz?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-screen-scene')).not.toBeInTheDocument();
    expect(playQuizVotingSignal).toHaveBeenCalledTimes(1);
  });

  it('re-presents the same quiz identity when the event changes', async () => {
    const playQuizVotingSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadQuiz: vi.fn().mockResolvedValue(voting),
      subscribeToQuizRefresh: () => vi.fn(),
      playQuizVotingSignal,
    };

    const { rerender } = render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    rerender(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="another-event"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(playQuizVotingSignal).toHaveBeenCalledTimes(2);
  });
});
