import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RegisteredGuest } from '../registration/registration.types';
import type { GuestQuizState } from '../quiz/quiz.service';
import { GuestHub } from './GuestHub';

const guest: RegisteredGuest = {
  id: 'guest-1',
  firstName: 'Илья',
  lastName: 'Тестов',
  affiliationType: 'common',
  affiliationDetail: '',
  ticketNumber: 'LV-027',
  carriage: {
    id: 'carriage-3',
    number: 3,
    label: 'ВАГОН №3',
    accentHex: '#31483a',
    visualMark: 'III',
  },
};

const liveQuiz: GuestQuizState = {
  status: 'active',
  phase: 'voting',
  roundId: 'round-1',
  phaseStartedAt: '2026-08-19T10:00:00.000Z',
  phaseEndsAt: '2026-08-19T10:00:30.000Z',
  question: {
    id: 'question-1',
    text: 'Кто лучше готовит?',
    questionType: 'standard',
    imagePath: null,
  },
  selectedChoice: null,
  answeredCount: 12,
  history: [],
};

describe('GuestHub', () => {
  it('keeps the ticket visible and promotes a live quiz without navigation', () => {
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        quizState={liveQuiz}
        onQuizVote={vi.fn()}
      />,
    );

    expect(screen.getByRole('main')).toHaveTextContent('ВАШ ВЕЧЕР');
    expect(screen.getByTestId('virtual-ticket')).toHaveTextContent('LV-027');
    expect(screen.getByText('Кто лучше готовит?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ЛИЗА/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /MORTAL KOMBAT/i })).toHaveAttribute('href', '/mortal-kombat');
  });

  it('shows an idle live area while keeping the personal cabinet', () => {
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    expect(screen.getByText('ОЖИДАЕМ СЛЕДУЮЩЕЕ СОБЫТИЕ')).toBeInTheDocument();
    expect(screen.getByLabelText('История вечера')).toBeInTheDocument();
  });
});
