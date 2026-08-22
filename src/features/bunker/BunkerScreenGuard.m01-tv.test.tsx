import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard } from './BunkerScreenGuard';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const activeRun = {
  status: 'active' as const,
  startedAt: '2026-08-21T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 1500,
  soundEnabled: false,
  phase: 'dossier_1' as const,
  unlocked: false,
  teams: [],
  characterCounts: { active: 12, saved: 0, excluded: 0 },
  globalGameState: 'MISSION_01' as const,
  currentMission: { id: 'mission-01', state: 'MISSION_01', plan: null },
  serverNow: '2026-08-21T18:05:00.000Z',
};

const missionOneProjection = {
  contractVersion: 2 as const,
  status: 'active' as const,
  serverNow: '2026-08-21T18:05:00.000Z',
  deadlineAt: '2026-08-21T18:09:00.000Z',
  title: 'Лишний пассажир',
  publicSummary: 'Вагоны принимают решение по открытым частям досье.',
  wagons: [{ wagonId: 'carriage-1', label: 'ВАГОН №1', status: 'active' as const }],
};

describe('BunkerScreenGuard · M01 on common TV', () => {
  it('shows a protected mission scene even before the optional M01 projection arrives', async () => {
    render(
      <BunkerScreenGuard dependencies={{ load: vi.fn().mockResolvedValue(activeRun) }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flush();

    expect(screen.getByRole('region', { name: 'Задание 1 · общий экран' })).toBeInTheDocument();
    expect(screen.getByText(/ЛИШНИЙ ПАССАЖИР/)).toBeInTheDocument();
    expect(screen.queryByText('ЛИЧНЫЕ ТЕРМИНАЛЫ АКТИВНЫ')).not.toBeInTheDocument();
  });

  it('keeps base TV state when the mission projection request fails and recovers later', async () => {
    let refresh: (() => void) | undefined;
    const loadMissionOne = vi.fn()
      .mockRejectedValueOnce(new Error('projection unavailable'))
      .mockResolvedValue(missionOneProjection);

    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue(activeRun),
        loadMissionOne,
        subscribe: (callback) => { refresh = callback; return () => undefined; },
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flush();

    expect(screen.getByRole('region', { name: 'Задание 1 · общий экран' })).toBeInTheDocument();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Вагоны принимают решение по открытым частям досье.')).toBeInTheDocument();
  });

  it('keeps the legacy V1 scene when the optional V2 projection reports legacy', async () => {
    const legacyProjection = {
      contractVersion: 2 as const,
      status: 'legacy' as const,
      serverNow: activeRun.serverNow,
    };

    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue(activeRun),
        loadMissionOne: vi.fn().mockResolvedValue(legacyProjection),
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flush();

    expect(screen.getByRole('region', { name: 'Бункер · общий экран' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Задание 1 · общий экран' })).not.toBeInTheDocument();
  });
});