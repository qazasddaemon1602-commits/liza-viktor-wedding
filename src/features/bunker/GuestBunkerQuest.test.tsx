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
    expect(screen.getByText('КОМАНДА · ВАГОН 2')).toBeInTheDocument();
    expect(screen.getAllByText('СКРЫТО ДО КОМАНДЫ ВЕДУЩЕГО').length).toBeGreaterThanOrEqual(4);
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
    await user.click(screen.getByRole('button', { name: '7' }));
    expect(onMission).toHaveBeenCalledWith('mission_a', '7');
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

  it('turns the final terminal into a global unlocked state', () => {
    render(
      <GuestBunkerQuest
        state={{ ...base, phase: 'final', final: { unlocked: true } }}
        onMission={vi.fn()}
        onFinalCode={vi.fn()}
      />,
    );

    expect(screen.getByText('ДОСТУП ПОЛУЧЕН')).toBeInTheDocument();
    expect(screen.getByText('ОЖИДАЕМ ПРИБЫТИЕ')).toBeInTheDocument();
  });
});
