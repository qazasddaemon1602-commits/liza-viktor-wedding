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
    expect(screen.getByText('ОТВЕТ ПРИНЯТ')).toHaveAttribute('role', 'status');
  });
});
