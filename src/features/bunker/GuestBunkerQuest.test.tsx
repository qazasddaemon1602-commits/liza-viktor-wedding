import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuestBunkerQuest } from './GuestBunkerQuest';
import type { GuestBunkerQuestState } from './bunkerQuest.types';

const base: Extract<GuestBunkerQuestState, { status: 'active' }> = {
  status: 'active',
  phase: 'dossier_1',
  phaseStartedAt: '2026-08-30T18:02:00.000Z',
  startedAt: '2026-08-30T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 1680,
  serverNow: '2026-08-30T18:02:00.000Z',
  dossier: {
    profession: 'АРХИТЕКТОР',
    profile: '31 ГОД · ЛЮБИТ ПОРЯДОК',
    health: null,
    hobby: null,
    baggage: null,
    hiddenFact: null,
    abilityTags: ['technical', 'bunker_knowledge'],
  },
  team: null,
  final: { unlocked: false },
};

describe('GuestBunkerQuest', () => {
  it('shows the emergency takeover without asking the guest to navigate away', () => {
    render(
      <GuestBunkerQuest
        state={{ ...base, phase: 'emergency', dossier: null }}
        onMission={vi.fn()}
        onFinalCode={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Бункер' })).toHaveTextContent('ПОЕЗД ИЗМЕНИЛ МАРШРУТ');
    expect(screen.getByText('28:00')).toBeInTheDocument();
  });

  it('reveals dossier progressively instead of rerolling or exposing future fields', () => {
    render(<GuestBunkerQuest state={base} carriageNumber={2} onMission={vi.fn()} onFinalCode={vi.fn()} />);

    expect(screen.getByText('АРХИТЕКТОР')).toBeInTheDocument();
    expect(screen.getByText('31 ГОД · ЛЮБИТ ПОРЯДОК')).toBeInTheDocument();
    expect(screen.getByText('ТЕХНИЧЕСКИЙ СПЕЦИАЛИСТ · ЗНАНИЕ БУНКЕРА')).toBeInTheDocument();
    expect(screen.getByText('КОМАНДА · ВАГОН 2')).toBeInTheDocument();
    expect(screen.getAllByText('СКРЫТО ДО КОМАНДЫ ВЕДУЩЕГО').length).toBeGreaterThanOrEqual(4);
  });

  it('does not show an empty carriage placeholder while assignment is unresolved', () => {
    render(<GuestBunkerQuest state={base} onMission={vi.fn()} onFinalCode={vi.fn()} />);

    expect(screen.getByText('КОМАНДА')).toBeInTheDocument();
    expect(screen.queryByText(/ВАГОН\s+—/)).not.toBeInTheDocument();
  });

  it('submits the current carriage mission and keeps wrong-answer retries local', async () => {
    const user = userEvent.setup();
    const onMission = vi.fn().mockResolvedValue(undefined);
    render(
      <GuestBunkerQuest
        state={{
          ...base,
          phase: 'mission_a',
          dossier: { ...base.dossier!, health: 'НЕ ЛЮБИТ ХОЛОД', hobby: 'ШАХМАТЫ', baggage: 'АПТЕЧКА', hiddenFact: 'ЗНАЕТ АЗБУКУ МОРЗЕ' },
          team: {
            carriageNumber: 3,
            stage: 'mission_a',
            mission: { title: 'ДАВЛЕНИЕ · ВАГОН 03', prompt: 'Выберите безопасное значение', options: ['3', '7', '11'] },
            completed: false,
            attemptCount: 1,
            fragment: null,
          },
        }}
        onMission={onMission}
        onFinalCode={vi.fn()}
        feedback="Ответ не подошёл. Попробуйте ещё раз."
      />,
    );

    expect(screen.getByText(/Ответ не подошёл/)).toBeInTheDocument();
    const evidence = screen.getByTestId('bunker-mission-evidence');
    expect(evidence).toHaveAttribute('aria-hidden', 'true');
    expect(evidence.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/evidence-03-480.avif 480w, /images/bunker/evidence-03-960.avif 960w',
    );
    expect(evidence.querySelector('source[type="image/webp"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/evidence-03-480.webp 480w, /images/bunker/evidence-03-960.webp 960w',
    );
    expect(evidence.querySelector('img')).toHaveAttribute('src', '/images/bunker/evidence-03.png');
    expect(evidence.querySelector('img')).toHaveAttribute('alt', '');
    await user.click(screen.getByRole('button', { name: '7' }));
    expect(onMission).toHaveBeenCalledWith('mission_a', '7');
  });

  it.each([1, 2, 3, 4, 5])(
    'maps carriage %i to its own mission-A evidence plate without changing mission data',
    (carriageNumber) => {
      render(
        <GuestBunkerQuest
          state={{
            ...base,
            phase: 'mission_a',
            team: {
              carriageNumber,
              stage: 'mission_a',
              mission: { title: 'ТЕХНИЧЕСКИЙ ОСМОТР', prompt: 'Сверьте признаки', options: ['A', 'B'] },
              completed: false,
              attemptCount: 0,
              fragment: null,
            },
          }}
          onMission={vi.fn()}
          onFinalCode={vi.fn()}
        />,
      );

      expect(screen.getByTestId('bunker-mission-evidence').querySelector('img')).toHaveAttribute(
        'src',
        `/images/bunker/evidence-${String(carriageNumber).padStart(2, '0')}.png`,
      );
      expect(screen.getByText('Сверьте признаки')).toBeInTheDocument();
    },
  );

  it('reserves the sixth evidence plate for the shared mission-B layer', () => {
    render(
      <GuestBunkerQuest
        state={{
          ...base,
          phase: 'mission_b',
          team: {
            carriageNumber: 4,
            stage: 'mission_b',
            mission: { title: 'КОНТУР СВЯЗИ', prompt: 'Сверьте маршрут', options: [] },
            completed: false,
            attemptCount: 0,
            fragment: null,
          },
        }}
        onMission={vi.fn()}
        onFinalCode={vi.fn()}
      />,
    );

    expect(screen.getByTestId('bunker-mission-evidence').querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/evidence-06.png',
    );
  });

  it('shows an earned fragment and accepts the shared final code', async () => {
    const user = userEvent.setup();
    const onFinalCode = vi.fn().mockResolvedValue(undefined);
    render(
      <GuestBunkerQuest
        state={{
          ...base,
          phase: 'final',
          dossier: { ...base.dossier!, health: 'НЕ ЛЮБИТ ХОЛОД', hobby: 'ШАХМАТЫ', baggage: 'АПТЕЧКА', hiddenFact: 'ЗНАЕТ АЗБУКУ МОРЗЕ' },
          team: { carriageNumber: 3, completed: true, fragment: '42' },
        }}
        onMission={vi.fn()}
        onFinalCode={onFinalCode}
      />,
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Общий код Бункера'), '1122334455');
    await user.click(screen.getByRole('button', { name: 'ОТКРЫТЬ ШЛЮЗ' }));
    expect(onFinalCode).toHaveBeenCalledWith('1122334455');
  });

  it('turns the final terminal and decorative door into a global unlocked state', () => {
    const { rerender } = render(
      <GuestBunkerQuest
        state={{ ...base, phase: 'final', final: { unlocked: false } }}
        onMission={vi.fn()}
        onFinalCode={vi.fn()}
      />,
    );

    let door = screen.getByTestId('bunker-guest-door');
    expect(door.querySelector('img')).toHaveAttribute('src', '/images/bunker/bunker-door-closed.png');

    rerender(
      <GuestBunkerQuest
        state={{ ...base, phase: 'final', final: { unlocked: true } }}
        onMission={vi.fn()}
        onFinalCode={vi.fn()}
      />,
    );

    door = screen.getByTestId('bunker-guest-door');
    expect(door.querySelector('img')).toHaveAttribute('src', '/images/bunker/bunker-door-open.png');
    expect(door.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.getByText('ДОСТУП ПОЛУЧЕН')).toBeInTheDocument();
    expect(screen.getByText('ОЖИДАЕМ ПРИБЫТИЕ')).toBeInTheDocument();
  });
});
