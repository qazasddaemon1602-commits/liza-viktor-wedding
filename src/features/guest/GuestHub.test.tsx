import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// @ts-expect-error Vitest runs this layout contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveGuestBunkerRuntime } from '../bunker/bunkerRuntime.service';
import type { RegisteredGuest } from '../registration/registration.types';
import type { GuestQuizState } from '../quiz/quiz.service';
import { GuestHub } from './GuestHub';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const guestHubCss = readFileSync(
  `${testRuntime.process.cwd()}/src/styles/guest-hub.css`,
  'utf8',
);

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

  it('keeps the empty-inventory status in the copy flow with responsive separation', () => {
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    const inventory = screen.getByLabelText('Инвентарь');
    const copy = inventory.querySelector('.guest-hub-inventory__copy');
    const status = screen.getByText('ПОЯВИТСЯ ПОСЛЕ ЗАПУСКА БУНКЕРА');

    expect(copy).not.toBeNull();
    expect(copy).toContainElement(screen.getByText('ИНВЕНТАРЬ ПУСТ'));
    expect(copy).toContainElement(screen.getByText(/Предметы вагона появятся/));
    expect(copy).toContainElement(status);
    expect(status).toHaveClass('guest-hub-inventory__status');

    const copyRule = guestHubCss.match(/\.guest-hub-inventory__copy\s*\{([^}]*)\}/)?.[1] ?? '';
    const statusRule = guestHubCss.match(/\.guest-hub-inventory__status\s*\{([^}]*)\}/)?.[1] ?? '';
    const statusMargin = Number(statusRule.match(/margin-top:\s*([\d.]+)rem/)?.[1] ?? 0);
    expect(copyRule).toMatch(/display:\s*grid/);
    expect(copyRule).toMatch(/gap:\s*(?:0\.[5-9]|[1-9])rem/);
    expect(statusMargin).toBeGreaterThanOrEqual(0.2);
    expect(statusRule).toMatch(/overflow-wrap:\s*anywhere/);
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

  it('mounts the server-backed M01 decision for a V2 guest and forwards its confirmation', async () => {
    const user = userEvent.setup();
    const onConfirmBunkerMissionOne = vi.fn().mockResolvedValue(undefined);
    render(
      <GuestHub
        guest={guest}
        activeCall={null}
        bunkerRuntime={{
          contractVersion: 2,
          status: 'active',
          serverNow: '2026-08-21T18:00:01.000Z',
          state: 'MISSION_01',
          planVersion: 1,
          runNonce: '41000000-0000-4000-8000-000000000001',
          viewer: {
            kind: 'guest',
            guest: { id: guest.id, realName: 'Илья Тестов' },
            wagon: { number: 3, label: 'ВАГОН №3' },
          },
          character: {
            profileKey: 'mechanic', profileVersion: 1, profession: 'Механик',
            health: 'Полностью здоров', visibleSkill: 'Чинит механизмы',
            specialAbility: 'mechanical_fix', abilityDescription: 'Устраняет поломку.',
            abilityUsesRemaining: 1, status: 'excluded', m01Eligibility: 'frozen_member',
            hiddenTraitRevealed: false,
          },
          currentMission: {
            instanceId: '41000000-0000-4000-8000-000000000010', instanceVersion: 1,
            code: 'MISSION_01', status: 'active', scope: 'wagon',
          },
        }}
        bunkerMissionOne={{
          instanceId: '41000000-0000-4000-8000-000000000010',
          instanceVersion: 1,
          status: 'active',
          wagon: { number: 3, label: 'ВАГОН №3' },
          quota: 1,
          remainingSeconds: 239,
          connection: 'online',
          members: [{
            guestId: guest.id, realName: 'Илья Тестов', profession: 'Механик',
            health: 'Полностью здоров', visibleSkill: 'Чинит механизмы',
          }],
          selectedGuestIds: [],
        }}
        onConfirmBunkerMissionOne={onConfirmBunkerMissionOne}
        quizState={{ status: 'idle', history: [] }}
        onQuizVote={vi.fn()}
      />,
    );

    const mission = screen.getByRole('region', { name: 'Миссия 01 · Лишний пассажир' });
    expect(mission).toBeInTheDocument();
    expect(screen.getByText(/персонаж исключён из истории/i)).toBeInTheDocument();
    await user.click(within(mission).getByRole('checkbox', { name: /илья тестов/i }));
    await user.click(within(mission).getByRole('button', { name: 'Подтвердить решение' }));
    await user.click(
      within(screen.getByRole('alertdialog', { name: 'Проверьте решение вагона' }))
        .getByRole('button', { name: 'Подтвердить решение' }),
    );
    expect(onConfirmBunkerMissionOne).toHaveBeenCalledWith([guest.id]);
  });
});
