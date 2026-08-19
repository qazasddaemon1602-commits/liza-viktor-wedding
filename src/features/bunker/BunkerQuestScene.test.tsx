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
  serverNow: '2026-08-30T18:15:00.000Z',
};

describe('BunkerQuestScene', () => {
  it('shows mission progress for all five carriages without fragments', () => {
    render(<BunkerQuestScene state={active} remainingSeconds={900} />);

    expect(screen.getByText('КОМАНДНАЯ ЗАДАЧА A')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getAllByText(/ВАГОН №/)).toHaveLength(5);
    expect(screen.getByText('3 / 5 ГОТОВО')).toBeInTheDocument();
    expect(screen.queryByText(/ФРАГМЕНТ/)).not.toBeInTheDocument();
  });

  it('shows final access as locked/unlocked slots rather than revealing digits', () => {
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
    expect(screen.getByText('4 / 5 ФРАГМЕНТОВ')).toBeInTheDocument();
    expect(screen.getAllByText('OPEN')).toHaveLength(4);
    expect(screen.getAllByText('LOCKED')).toHaveLength(1);
  });

  it('keeps the Bunker scene at zero and distinguishes locked from unlocked arrival', () => {
    const { rerender } = render(
      <BunkerQuestScene state={{ ...active, phase: 'final' }} remainingSeconds={0} />,
    );
    expect(screen.getByText('ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН')).toBeInTheDocument();

    rerender(<BunkerQuestScene state={{ ...active, phase: 'final', unlocked: true }} remainingSeconds={0} />);
    expect(screen.getByText('ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН')).toBeInTheDocument();
  });
});
