import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BunkerQuestScene } from './BunkerQuestScene';
import type { BunkerScreenState } from './bunker.service';

const active: Extract<BunkerScreenState, { status: 'active' }> = {
  status: 'active',
  startedAt: '2026-08-30T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 900,
  soundEnabled: false,
  phase: 'mission_a',
  unlocked: false,
  teams: Array.from({ length: 5 }, (_, index) => ({
    carriageNumber: index + 1,
    label: `ВАГОН №${index + 1}`,
    missionAComplete: index < 3,
    missionBComplete: false,
  })),
  characterCounts: { active: 16, saved: 3, excluded: 1 },
  serverNow: '2026-08-30T18:15:00.000Z',
};

describe('BunkerQuestScene', () => {
  it.each([2, 3, 4, 5])('renders exactly %i authoritative active wagons in the matching adaptive grid', (count) => {
    const teams = Array.from({ length: count }, (_, index) => ({
      carriageNumber: (index + 1) * 2,
      label: `АКТИВНЫЙ ВАГОН ${index + 1}`,
      missionAComplete: index === 0,
      missionBComplete: false,
    }));

    const { container } = render(
      <BunkerQuestScene state={{ ...active, teams }} remainingSeconds={900} />,
    );

    const grid = container.querySelector('.bunker-wagon-grid');
    expect(grid).toHaveAttribute('data-count', String(count));
    expect(grid?.querySelectorAll('article')).toHaveLength(count);
    expect(screen.getAllByText(/АКТИВНЫЙ ВАГОН/)).toHaveLength(count);
    expect(screen.queryByText('ВАГОН №1')).not.toBeInTheDocument();
  });

  it('shows mission progress for all five carriages without fragments', () => {
    render(<BunkerQuestScene state={active} remainingSeconds={900} />);

    expect(screen.getByText('КОМАНДНАЯ ЗАДАЧА A')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getAllByText(/ВАГОН №/)).toHaveLength(5);
    expect(screen.getByText('3 / 5 ГОТОВО')).toBeInTheDocument();
    expect(screen.queryByText(/ФРАГМЕНТ/)).not.toBeInTheDocument();
    expect(screen.getByText('ПЕРСОНАЖИ · 16 АКТИВНЫ · 3 СПАСЕНЫ · 1 ИСКЛЮЧЁН')).toBeInTheDocument();
  });

  it.each([
    ['MISSION_01', 2],
    ['MISSION_03', 1],
    ['MISSION_04', 3],
    ['MISSION_06', 4],
  ] as const)('uses stage-specific server progress for %s instead of legacy mission flags', (globalGameState, completed) => {
    const teams = active.teams.map((team, index) => ({
      ...team,
      missionAComplete: true,
      missionBComplete: true,
      currentMissionComplete: index < completed,
    }));

    render(
      <BunkerQuestScene
        state={{
          ...active,
          globalGameState,
          currentMission: { id: globalGameState.toLowerCase(), state: globalGameState, plan: null },
          teams,
        }}
        remainingSeconds={600}
      />,
    );

    expect(screen.getByText(`${completed} / 5 ГОТОВО`)).toBeInTheDocument();
    expect(screen.getAllByText('ГОТОВ')).toHaveLength(completed);
    expect(screen.getAllByText('В РАБОТЕ')).toHaveLength(5 - completed);
  });

  it('marks a long authoritative mission objective for viewport-safe typography without truncating it', () => {
    const objective = 'Сверьте архивные фрагменты, восстановите повреждённый маршрут и согласуйте итоговый протокол между всеми вагонами';
    render(
      <BunkerQuestScene
        state={{
          ...active,
          globalGameState: 'MISSION_04',
          currentMission: { id: 'mission_04', state: 'MISSION_04', plan: { objective } },
        }}
        remainingSeconds={720}
      />,
    );

    const scene = screen.getByLabelText('Бункер · экран квеста');
    expect(scene).toHaveAttribute('data-headline-density', 'long');
    expect(screen.getByRole('heading', { name: `МИССИЯ 04 · ${objective.toLocaleUpperCase('ru-RU')}` }))
      .toBeInTheDocument();
  });

  it('shows final wagon data readiness without claiming that the Bunker is open', () => {
    render(
      <BunkerQuestScene
        state={{
          ...active,
          phase: 'final',
          teams: active.teams.map((team, index) => ({ ...team, missionAComplete: true, missionBComplete: index < 4 })),
        }}
        remainingSeconds={320}
      />,
    );

    expect(screen.getByText('ФИНАЛЬНЫЙ ДОСТУП')).toBeInTheDocument();
    expect(screen.getByText('4 / 5 ВАГОНОВ ПЕРЕДАЛИ ДАННЫЕ')).toBeInTheDocument();
    expect(screen.getAllByText('ДАННЫЕ ПОЛУЧЕНЫ')).toHaveLength(4);
    expect(screen.getAllByText('ОЖИДАЕМ ДАННЫЕ')).toHaveLength(1);
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument();
  });

  it('keeps the Bunker scene at zero and distinguishes locked from unlocked arrival', () => {
    const { rerender } = render(
      <BunkerQuestScene state={{ ...active, phase: 'final' }} remainingSeconds={0} />,
    );
    expect(screen.getByText('ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН')).toBeInTheDocument();

    rerender(<BunkerQuestScene state={{ ...active, phase: 'final', unlocked: true }} remainingSeconds={0} />);
    expect(screen.getByText('ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН')).toBeInTheDocument();
  });

  it('uses a safe summary instead of inventing wagon cards when the screen payload has no teams', () => {
    const { container } = render(
      <BunkerQuestScene state={{ ...active, teams: [] }} remainingSeconds={900} />,
    );

    expect(screen.getByText('ДАННЫЕ ОБ АКТИВНЫХ ВАГОНАХ НЕ ПОЛУЧЕНЫ')).toBeInTheDocument();
    expect(container.querySelector('.bunker-wagon-grid')).not.toBeInTheDocument();
  });

  it.each([2, 3, 4, 5])(
    'uses one text-free master map as a crop-safe strip across %i active wagons',
    (count) => {
    const teams = active.teams.slice(0, count);
    render(<BunkerQuestScene state={{ ...active, phase: 'final', teams }} remainingSeconds={300} />);

    const fragments = screen.getAllByTestId('bunker-map-fragment');
    expect(fragments).toHaveLength(count);
    fragments.forEach((fragment, index) => {
      expect(fragment).toHaveAttribute('data-fragment-index', String(index));
      expect(fragment).toHaveAttribute('data-fragment-count', String(count));
      expect(fragment.querySelector('source[type="image/avif"]')).toHaveAttribute(
        'srcset',
        '/images/bunker/tunnel-map-master-960.avif 960w, /images/bunker/tunnel-map-master-1920.avif 1920w',
      );
      expect(fragment.querySelector('img')).toHaveAttribute('alt', '');
    });
  });

  it('switches only the final decorative door plate from closed to open-light', () => {
    const { rerender } = render(
      <BunkerQuestScene state={{ ...active, phase: 'final' }} remainingSeconds={300} />,
    );

    let backdrop = screen.getByTestId('bunker-scene-backdrop');
    expect(backdrop.querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/bunker-door-closed.png',
    );

    rerender(
      <BunkerQuestScene
        state={{ ...active, phase: 'final', unlocked: true }}
        remainingSeconds={300}
      />,
    );
    backdrop = screen.getByTestId('bunker-scene-backdrop');
    expect(backdrop.querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/bunker-door-open.png',
    );
    expect(backdrop.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('renders the authoritative global mission even when a stale legacy phase disagrees', () => {
    render(
      <BunkerQuestScene
        state={{
          ...active,
          phase: 'dossier_1',
          globalGameState: 'MISSION_04',
          currentMission: {
            id: 'mission_04', state: 'MISSION_04', plan: { objective: 'Собрать маршрут' },
          },
        }}
        remainingSeconds={800}
      />,
    );

    expect(screen.getByTestId('bunker-scene-backdrop').querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/tunnel-map-master.png',
    );
    expect(screen.getByText('МИССИЯ 04 · СОБРАТЬ МАРШРУТ')).toBeInTheDocument();
  });

  it('adds the canonical mission intro and existing evidence artwork to the TV scene', () => {
    render(
      <BunkerQuestScene
        state={{
          ...active,
          globalGameState: 'MISSION_04',
          currentMission: {
            id: 'mission_04', state: 'MISSION_04', plan: { objective: 'Восстановить связь' },
          },
        }}
        remainingSeconds={640}
      />,
    );

    const scene = screen.getByLabelText('Бункер · экран квеста');
    expect(scene).toHaveAttribute('data-mission-key', 'M04');
    expect(screen.getByRole('heading', { name: 'Межвагонная связь' })).toBeInTheDocument();
    expect(screen.getByText(/найдите свою группу/i)).toBeInTheDocument();
    expect(screen.getByText(/состав больше не слышит сам себя/i)).toBeInTheDocument();
    expect(screen.getByTestId('bunker-mission-artwork').querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/evidence-04.png',
    );
  });

  it('keeps the final story plate consistent with the unlocked door state', () => {
    render(
      <BunkerQuestScene
        state={{ ...active, globalGameState: 'FINAL_30', phase: 'final', unlocked: true }}
        remainingSeconds={240}
      />,
    );

    expect(screen.getByTestId('bunker-mission-artwork').querySelector('img')).toHaveAttribute(
      'src',
      '/images/bunker/bunker-door-open.png',
    );
  });

  it('uses one train-window wipe in full motion and omits it for reduced motion', () => {
    const { rerender } = render(
      <BunkerQuestScene state={active} remainingSeconds={900} motionPreference="full" />,
    );

    const wipe = screen.getByTestId('bunker-train-window-wipe');
    expect(wipe).toHaveAttribute('aria-hidden', 'true');
    expect(wipe.tagName).toBe('PICTURE');
    expect(wipe.querySelector('source[type="image/avif"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/train-window-wipe.avif',
    );
    expect(wipe.querySelector('source[type="image/webp"]')).toHaveAttribute(
      'srcset',
      '/images/bunker/train-window-wipe.webp',
    );
    const image = wipe.querySelector('img');
    expect(image).toHaveAttribute(
      'src',
      '/images/bunker/train-window-wipe.png',
    );
    expect(image).toHaveAttribute('width', '2048');
    expect(image).toHaveAttribute('height', '1152');

    rerender(
      <BunkerQuestScene state={active} remainingSeconds={900} motionPreference="reduced" />,
    );
    expect(screen.getByLabelText('Бункер · экран квеста')).toHaveAttribute('data-motion', 'reduced');
    expect(screen.queryByTestId('bunker-train-window-wipe')).not.toBeInTheDocument();
  });

});
