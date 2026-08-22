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

function legacyState(globalGameState: 'FINAL_30' | 'BUNKER_OPEN') {
  return {
    status: 'active' as const,
    startedAt: '2026-08-30T20:00:00.000Z',
    durationSeconds: 1800,
    remainingSeconds: 600,
    soundEnabled: false,
    phase: globalGameState === 'FINAL_30' ? 'final' as const : 'completed' as const,
    unlocked: globalGameState === 'BUNKER_OPEN',
    teams: [{
      carriageNumber: 1,
      label: 'ВАГОН №1',
      missionAComplete: true,
      missionBComplete: true,
    }],
    characterCounts: { active: 10, saved: 5, excluded: 2 },
    globalGameState,
    currentMission: globalGameState === 'FINAL_30'
      ? { id: 'legacy-final', state: 'FINAL_30' as const, plan: null }
      : null,
    serverNow: '2026-08-30T20:20:00.000Z',
  };
}

const legacyProjection = {
  contractVersion: 2 as const,
  status: 'legacy' as const,
  serverNow: '2026-08-30T20:20:00.000Z',
};

describe('BunkerScreenGuard legacy final compatibility', () => {
  it('keeps FINAL_30 on the legacy quest scene when V2 reads report legacy', async () => {
    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue(legacyState('FINAL_30')),
        loadFinal: vi.fn().mockResolvedValue(legacyProjection),
      }}>
        <div>base</div>
      </BunkerScreenGuard>,
    );
    await flush();

    expect(screen.getByRole('region', { name: 'Бункер · экран квеста' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Финал · общий экран' })).not.toBeInTheDocument();
  });

  it('keeps BUNKER_OPEN on the legacy completed scene instead of V2 results', async () => {
    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue(legacyState('BUNKER_OPEN')),
        loadMissionOne: vi.fn().mockResolvedValue(legacyProjection),
      }}>
        <div>base</div>
      </BunkerScreenGuard>,
    );
    await flush();

    expect(screen.getByRole('region', { name: 'Бункер · экран квеста' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Бункер открыт · итоги игры' })).not.toBeInTheDocument();
  });

  it('does not assume V2 while the final contract read is still pending', async () => {
    let resolveFinal: ((value: typeof legacyProjection) => void) | undefined;
    const pendingFinal = new Promise<typeof legacyProjection>((resolve) => {
      resolveFinal = resolve;
    });

    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue(legacyState('FINAL_30')),
        loadFinal: vi.fn().mockReturnValue(pendingFinal),
      }}>
        <div>base</div>
      </BunkerScreenGuard>,
    );
    await flush();

    expect(screen.getByRole('region', { name: 'Бункер · экран квеста' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Финал · общий экран' })).not.toBeInTheDocument();

    await act(async () => {
      resolveFinal?.(legacyProjection);
      await pendingFinal;
    });

    expect(screen.getByRole('region', { name: 'Бункер · экран квеста' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Финал · общий экран' })).not.toBeInTheDocument();
  });
});
