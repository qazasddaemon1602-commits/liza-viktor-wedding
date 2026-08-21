import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveGuestBunkerRuntime } from '../bunker/bunkerRuntime.service';
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

const bunkerRuntime: ActiveGuestBunkerRuntime = {
  status: 'active',
  serverNow: '2026-08-20T18:00:00.000Z',
  game: {
    runNonce: 'run-1', state: 'MISSION_03', mode: 'production', finalStartedAt: null,
    finalDuration: 1800, bunkerRevealed: false,
  },
  guest: { id: 'guest-1', realName: 'Илья Тестов', joinedLate: false },
  wagon: { id: 'carriage-3', number: 3, label: 'ВАГОН №3' },
  character: {
    profession: 'АРХИВИСТ', health: 'стабильное', visibleSkill: 'анализ документов',
    hiddenTrait: null, hiddenTraitRevealed: false, specialAbility: 'archive_access',
    abilityDescription: 'Распознаёт повреждённые архивные записи.', abilityUsesRemaining: 1,
    status: 'active',
  },
  passengers: [], inventory: [], archive: [],
  wagonState: { powerStatus: 'stable', communicationStatus: 'working', navigationStatus: 'working' },
  currentMission: null,
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
    expect(screen.getByRole('link', { name: 'ПОСЛЕДНИЙ КРУГ · УЧАСТВОВАТЬ' })).toHaveAttribute('href', '/mortal-kombat');
    expect(screen.queryByText(/MORTAL KOMBAT|FATALITY/i)).not.toBeInTheDocument();
  });

  it('places the live event before the ticket so it is the first actionable phone card', () => {
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        quizState={liveQuiz}
        onQuizVote={vi.fn()}
      />,
    );

    const now = screen.getByLabelText('Сейчас происходит');
    const ticket = screen.getByLabelText('Мой билет');

    expect(now.compareDocumentPosition(ticket) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    const inventory = screen.getByLabelText('Инвентарь');
    expect(inventory).toHaveTextContent('ИНВЕНТАРЬ ПУСТ');
    expect(inventory).toHaveTextContent('ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА БУНКЕРА');
  });

  it('mounts the Bunker dashboard only for an authoritative active runtime', () => {
    const { rerender } = render(
      <GuestHub
        guest={guest}
        activeCall={null}
        bunkerRuntime={{ status: 'idle', serverNow: bunkerRuntime.serverNow }}
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Игровой модуль Бункер')).not.toBeInTheDocument();
    expect(screen.getByTestId('virtual-ticket')).toBeInTheDocument();

    rerender(
      <GuestHub
        guest={guest}
        activeCall={null}
        bunkerRuntime={bunkerRuntime}
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Игровой модуль Бункер')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ИЛЬЯ ТЕСТОВ' })).toBeInTheDocument();
    expect(screen.queryByTestId('virtual-ticket')).not.toBeInTheDocument();
  });

  it('keeps the wedding hub usable while the Bunker runtime loads or is offline', () => {
    const { rerender } = render(
      <GuestHub
        guest={guest}
        activeCall={null}
        bunkerRuntimeLoading
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/проверяем защищённый канал/i);
    expect(screen.getByTestId('virtual-ticket')).toBeInTheDocument();

    rerender(
      <GuestHub
        guest={guest}
        activeCall={null}
        bunkerRuntimeError="Не удалось обновить защищённый архив."
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/не удалось обновить защищённый архив/i);
    expect(screen.getByTestId('virtual-ticket')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Сейчас происходит').compareDocumentPosition(screen.getByRole('alert'))
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
