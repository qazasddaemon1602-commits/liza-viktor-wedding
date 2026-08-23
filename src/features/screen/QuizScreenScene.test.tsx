import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizScreenScene, toAvifQuizImagePath } from './QuizScreenScene';
import type { QuizScreenState } from '../quiz/quizScreen.service';

const votingState: Extract<QuizScreenState, { status: 'active'; phase: 'voting' }> = {
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

describe('QuizScreenScene', () => {
  it('uses the shared transition language for each presented phase', () => {
    const { rerender } = render(
      <QuizScreenScene state={votingState} expectedGuestCount={40} />,
    );

    expect(screen.getByTestId('scene-transition')).toHaveAttribute(
      'data-scene-key',
      'question-1:voting',
    );
    rerender(<QuizScreenScene state={votingState} expectedGuestCount={40} />);

    rerender(
      <QuizScreenScene
        state={{
          ...votingState,
          phase: 'results',
          results: { liza: 18, viktor: 12, total: 30 },
        }}
        expectedGuestCount={40}
      />,
    );
    expect(screen.getByTestId('scene-transition')).toHaveAttribute(
      'data-scene-key',
      'question-1:results',
    );
  });

  it('shows a live question and participation count without percentages before reveal', () => {
    render(<QuizScreenScene state={votingState} expectedGuestCount={40} />);

    expect(screen.getByText('ЛИЗА ИЛИ ВИКТОР?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Кто в доме главный?' })).toBeInTheDocument();
    expect(screen.getByText('17 / 40 ОТВЕТИЛИ')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows aggregate percentages after reveal', () => {
    const resultsState: Extract<QuizScreenState, { status: 'active'; phase: 'results' }> = {
      ...votingState,
      phase: 'results',
      answeredCount: 30,
      results: { liza: 18, viktor: 12, total: 30 },
    };

    render(<QuizScreenScene state={resultsState} expectedGuestCount={40} />);

    expect(screen.getByText('ЛИЗА')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('ВИКТОР')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('30 / 40 ОТВЕТИЛИ')).toBeInTheDocument();
  });

  it('renders the optional thematic image with AVIF preference and WebP fallback', () => {
    const withImage: typeof votingState = {
      ...votingState,
      question: {
        ...votingState.question,
        imagePath: '/quiz/chief.webp',
      },
    };

    const { container } = render(
      <QuizScreenScene state={withImage} expectedGuestCount={40} />,
    );

    const fallback = screen.getByRole('presentation');
    expect(fallback).toHaveAttribute('src', '/quiz/chief.webp');
    expect(fallback.closest('picture')).not.toBeNull();
    expect(container.querySelector('picture source')).toHaveAttribute('type', 'image/avif');
    expect(container.querySelector('picture source')).toHaveAttribute('srcset', '/quiz/chief.avif');
  });

  it('keeps query strings and fragments when deriving the AVIF candidate', () => {
    expect(toAvifQuizImagePath('/images/quiz/q02.webp?v=7#frame')).toBe(
      '/images/quiz/q02.avif?v=7#frame',
    );
    expect(toAvifQuizImagePath('/images/quiz/q02.png?v=7')).toBeNull();
  });

  it('omits the complete image frame when the question has no image', () => {
    const { container } = render(
      <QuizScreenScene state={votingState} expectedGuestCount={40} />,
    );

    expect(container.querySelector('.quiz-screen-image-frame')).toBeNull();
    expect(container.querySelector('picture')).toBeNull();
  });

  it('uses the wedding editorial spread and route mark for the TV composition', () => {
    render(<QuizScreenScene state={votingState} expectedGuestCount={40} />);

    expect(screen.getByTestId('quiz-editorial-spread')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-route-mark')).toBeInTheDocument();
    expect(screen.getByText('WEDDING EDITION · LV')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-editorial-spread')).toHaveAttribute('data-phase', 'voting');
    expect(screen.queryByTestId('quiz-transition-curtain')).not.toBeInTheDocument();
    expect(screen.getByText('17 / 40 ОТВЕТИЛИ')).not.toHaveAttribute('aria-live');
  });
});

