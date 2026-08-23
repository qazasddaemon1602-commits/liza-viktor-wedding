import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuestQuizState } from './quiz.service';
import { GuestLiveQuizCard } from './GuestLiveQuizCard';

const selectedState: Extract<GuestQuizState, { status: 'active' }> = {
  status: 'active',
  phase: 'voting',
  roundId: 'round-1',
  phaseStartedAt: '2026-08-30T12:00:00.000Z',
  phaseEndsAt: '2026-08-30T12:00:30.000Z',
  question: {
    id: 'question-1',
    text: 'Кто первым предложил отправиться в путешествие?',
    questionType: 'standard',
    imagePath: null,
  },
  selectedChoice: 'liza',
  answeredCount: 18,
  history: [],
};

describe('GuestLiveQuizCard', () => {
  it('exposes the chosen answer as a pressed mobile choice and keeps the question as its label', () => {
    render(<GuestLiveQuizCard state={selectedState} onVote={vi.fn()} compact />);

    expect(screen.getByRole('region', { name: selectedState.question.text })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: selectedState.question.text })).not.toHaveAttribute('aria-live');
    expect(screen.getByRole('button', { name: 'ЛИЗА' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ВИКТОР' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('ОТВЕТ ПРИНЯТ');
  });

  it('names the selected answer while it is being fixed and exposes a dedicated live status', () => {
    render(
      <GuestLiveQuizCard
        state={{ ...selectedState, selectedChoice: null }}
        submitting="liza"
        onVote={vi.fn()}
        compact
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('ЛИЗА · ФИКСИРУЕМ ОТВЕТ…');
    expect(status).toHaveAttribute('data-announcement-key', 'question-1:voting:submitting');
  });

  it('explains that a vote is locked when the results phase begins', () => {
    render(
      <GuestLiveQuizCard
        state={{
          ...selectedState,
          phase: 'results',
          results: { liza: 18, viktor: 12, total: 30 },
        }}
        onVote={vi.fn()}
        compact
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('ОТВЕТЫ ЗАФИКСИРОВАНЫ · ГОЛОСОВАНИЕ ЗАКРЫТО');
  });
});
