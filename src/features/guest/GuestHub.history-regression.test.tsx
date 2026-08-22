import { render, screen, within } from '@testing-library/react';
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

const quizState: GuestQuizState = {
  status: 'idle',
  history: [{
    roundId: 'round-1',
    questionId: 'question-1',
    questionText: 'Кто лучше готовит?',
    questionType: 'standard',
    closedAt: '2026-08-30T18:00:00.000Z',
    answeredCount: 10,
    results: { liza: 6, viktor: 4, total: 10 },
    selectedChoice: 'liza',
  }],
};

describe('GuestHub non-Bunker regressions', () => {
  it('keeps the pre-game inventory placeholder available outside an active Bunker run', () => {
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        quizState={quizState}
        onQuizVote={vi.fn()}
      />,
    );

    const inventory = screen.getByLabelText('Инвентарь');
    expect(inventory).toHaveTextContent('ИНВЕНТАРЬ ПУСТ');
    expect(inventory).toHaveTextContent('ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА БУНКЕРА');
  });

  it('keeps completed quiz percentages and the guest answer in evening history', () => {
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        quizState={quizState}
        onQuizVote={vi.fn()}
      />,
    );

    const history = within(screen.getByLabelText('История вечера'));
    expect(history.getByText('Кто лучше готовит?')).toBeInTheDocument();
    expect(history.getByText('Л 60%')).toBeInTheDocument();
    expect(history.getByText('В 40%')).toBeInTheDocument();
    expect(history.getByText('ВАШ ОТВЕТ · ЛИЗА')).toBeInTheDocument();
  });
});