import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizScreenScene } from './QuizScreenScene';
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

  it('renders the optional thematic image as decorative content', () => {
    const withImage: typeof votingState = {
      ...votingState,
      question: {
        ...votingState.question,
        imagePath: '/quiz/chief.webp',
      },
    };

    render(<QuizScreenScene state={withImage} expectedGuestCount={40} />);

    expect(screen.getByRole('presentation')).toHaveAttribute('src', '/quiz/chief.webp');
  });

  it('uses the wedding editorial spread and route mark for the TV composition', () => {
    render(<QuizScreenScene state={votingState} expectedGuestCount={40} />);

    expect(screen.getByTestId('quiz-editorial-spread')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-route-mark')).toBeInTheDocument();
    expect(screen.getByText('WEDDING EDITION · LV')).toBeInTheDocument();
  });
});
