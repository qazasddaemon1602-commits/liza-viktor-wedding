import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard, type BunkerScreenGuardDependencies } from './BunkerScreenGuard';

afterEach(() => {
  vi.useRealTimers();
});

async function flushLoadedState() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BunkerScreenGuard', () => {
  it.each([
    ['MISSION_03', 'mission_03', 'MISSION_04', 'mission_04'],
    ['MISSION_05', 'mission_05', 'MISSION_06', 'mission_06'],
  ] as const)(
    'remounts the artistic intro when the server advances from %s/%s to %s/%s inside one visual phase',
    async (firstState, firstMission, nextState, nextMission) => {
      let refresh: (() => void) | undefined;
      const base = {
        status: 'active' as const,
        startedAt: '2026-08-30T18:00:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 900,
        soundEnabled: false,
        phase: 'mission_a' as const,
        unlocked: false,
        teams: [],
        characterCounts: { active: 16, saved: 0, excluded: 0 },
      };
      const load = vi.fn()
        .mockResolvedValueOnce({
          ...base,
          globalGameState: firstState,
          currentMission: { id: firstMission, state: firstState, plan: null },
          serverNow: '2026-08-30T18:15:00.000Z',
        })
        .mockResolvedValueOnce({
          ...base,
          globalGameState: nextState,
          currentMission: { id: nextMission, state: nextState, plan: null },
          serverNow: '2026-08-30T18:15:01.000Z',
        });

      render(
        <BunkerScreenGuard dependencies={{
          load,
          subscribe: (callback) => {
            refresh = callback;
            return () => undefined;
          },
        }}>
          <div>ОБЫЧНЫЙ ЭКРАН</div>
        </BunkerScreenGuard>,
      );
      await flushLoadedState();
      const firstScene = screen.getByLabelText('Бункер · экран квеста');

      await act(async () => {
        refresh?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByLabelText('Бункер · экран квеста')).not.toBe(firstScene);
    },
  );

  it('selects the restored projector scene from authoritative globalGameState', async () => {
    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue({
          status: 'active',
          startedAt: '2026-08-30T18:00:00.000Z',
          durationSeconds: 1800,
          remainingSeconds: 900,
          soundEnabled: false,
          phase: 'emergency',
          unlocked: false,
          teams: [],
          characterCounts: { active: 16, saved: 0, excluded: 0 },
          globalGameState: 'MISSION_04',
          currentMission: { id: 'mission_04', state: 'MISSION_04', plan: null },
          serverNow: '2026-08-30T18:15:00.000Z',
        }),
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.queryByTestId('bunker-emergency-scene')).not.toBeInTheDocument();
    expect(screen.getByText('МИССИЯ 04')).toBeInTheDocument();
  });

  it('starts recorded ambience for an audible active run and plays the door only on an authoritative unlock transition', async () => {
    const audio = {
      arm: vi.fn().mockResolvedValue(true),
      startAlarm: vi.fn(),
      stopAlarm: vi.fn(),
      startAmbience: vi.fn(),
      stopAmbience: vi.fn(),
      playDoorUnlock: vi.fn(),
      dispose: vi.fn(),
    };
    let refresh: (() => void) | undefined;
    const base = {
      status: 'active' as const,
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 900,
      soundEnabled: true,
      phase: 'final' as const,
      teams: [],
      characterCounts: { active: 15, saved: 0, excluded: 0 },
      serverNow: '2026-08-30T18:15:00.000Z',
    };
    const load = vi.fn()
      .mockResolvedValueOnce({ ...base, unlocked: false })
      .mockResolvedValueOnce({ ...base, unlocked: true });

    render(
      <BunkerScreenGuard dependencies={{ load, subscribe: (callback) => { refresh = callback; return () => undefined; }, audio }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(audio.startAmbience).toHaveBeenCalledTimes(1);
    expect(audio.playDoorUnlock).not.toHaveBeenCalled();

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(audio.playDoorUnlock).toHaveBeenCalledTimes(1);
  });

  it('does not replay the door recording when a projector reconnects to an already unlocked scene', async () => {
    const audio = {
      arm: vi.fn().mockResolvedValue(true),
      startAlarm: vi.fn(),
      stopAlarm: vi.fn(),
      startAmbience: vi.fn(),
      stopAmbience: vi.fn(),
      playDoorUnlock: vi.fn(),
      dispose: vi.fn(),
    };
    const load = vi.fn().mockResolvedValue({
      status: 'active',
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 800,
      soundEnabled: true,
      phase: 'completed',
      unlocked: true,
      teams: [],
      characterCounts: { active: 15, saved: 15, excluded: 0 },
      serverNow: '2026-08-30T18:16:40.000Z',
    });

    render(
      <BunkerScreenGuard dependencies={{ load, audio }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(audio.startAmbience).toHaveBeenCalledTimes(1);
    expect(audio.playDoorUnlock).not.toHaveBeenCalled();
  });

  it('ignores stale screen snapshots so an out-of-order response cannot replay the door', async () => {
    const audio = {
      arm: vi.fn().mockResolvedValue(true),
      startAlarm: vi.fn(),
      stopAlarm: vi.fn(),
      startAmbience: vi.fn(),
      stopAmbience: vi.fn(),
      playDoorUnlock: vi.fn(),
      dispose: vi.fn(),
    };
    let refresh: (() => void) | undefined;
    const base = {
      status: 'active' as const,
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 900,
      soundEnabled: true,
      phase: 'final' as const,
      teams: [],
      characterCounts: { active: 15, saved: 0, excluded: 0 },
    };
    const load = vi.fn()
      .mockResolvedValueOnce({ ...base, unlocked: false, serverNow: '2026-08-30T18:15:00.000Z' })
      .mockResolvedValueOnce({ ...base, unlocked: true, serverNow: '2026-08-30T18:15:02.000Z' })
      .mockResolvedValueOnce({ ...base, unlocked: false, serverNow: '2026-08-30T18:15:01.000Z' })
      .mockResolvedValueOnce({ ...base, unlocked: true, serverNow: '2026-08-30T18:15:03.000Z' });

    render(
      <BunkerScreenGuard dependencies={{ load, subscribe: (callback) => { refresh = callback; return () => undefined; }, audio }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        refresh?.();
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    expect(audio.playDoorUnlock).toHaveBeenCalledTimes(1);
  });

  it('restores the current server scene and server-derived timer after a remount', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T20:00:00.000Z'));

    const base = {
      status: 'active' as const,
      startedAt: '2026-08-30T18:00:00.000Z',
      durationSeconds: 1800,
      soundEnabled: false,
      phase: 'mission_b' as const,
      unlocked: false,
      teams: [
        { carriageNumber: 2, label: 'ВАГОН №2', missionAComplete: true, missionBComplete: false },
        { carriageNumber: 4, label: 'ВАГОН №4', missionAComplete: true, missionBComplete: true },
      ],
    };
    const load = vi.fn()
      .mockResolvedValueOnce({
        ...base,
        remainingSeconds: 1200,
        serverNow: '2026-08-30T18:10:00.000Z',
      })
      .mockResolvedValueOnce({
        ...base,
        remainingSeconds: 1195,
        serverNow: '2026-08-30T18:10:05.000Z',
      });

    const first = render(
      <BunkerScreenGuard dependencies={{ load }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.getByText('КОМАНДНАЯ ЗАДАЧА B')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
    expect(screen.getAllByText(/ВАГОН №/)).toHaveLength(2);

    first.unmount();
    vi.setSystemTime(new Date('2026-08-30T20:00:05.000Z'));

    render(
      <BunkerScreenGuard dependencies={{ load }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.getByText('КОМАНДНАЯ ЗАДАЧА B')).toBeInTheDocument();
    expect(screen.getByText('19:55')).toBeInTheDocument();
    expect(screen.getAllByText(/ВАГОН №/)).toHaveLength(2);
  });

  it('anchors the final countdown to the authoritative server snapshot, not the earlier game start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T20:00:00.000Z'));

    render(
      <BunkerScreenGuard dependencies={{
        load: vi.fn().mockResolvedValue({
          status: 'active',
          startedAt: '2026-08-30T18:00:00.000Z',
          durationSeconds: 1800,
          remainingSeconds: 1800,
          soundEnabled: false,
          phase: 'final',
          globalGameState: 'FINAL_30',
          unlocked: false,
          teams: [],
          characterCounts: { active: 0, saved: 0, excluded: 0 },
          serverNow: '2026-08-30T20:00:00.000Z',
        }),
      }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.getByText('30:00')).toBeInTheDocument();
  });

  it('overlays the projector with the synchronized emergency message and 30 minute timer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T18:00:00.000Z'));

    const dependencies: BunkerScreenGuardDependencies = {
      load: vi.fn().mockResolvedValue({
        status: 'active',
        startedAt: '2026-08-30T18:00:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 1800,
        soundEnabled: false,
        serverNow: '2026-08-30T18:00:00.000Z',
      }),
    };

    render(
      <BunkerScreenGuard dependencies={dependencies}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.getByTestId('bunker-emergency-scene')).toBeInTheDocument();
    expect(screen.getByText('ЭКСТРЕННОЕ СООБЩЕНИЕ')).toBeInTheDocument();
    expect(screen.getByText('ПОЕЗД ИЗМЕНИЛ МАРШРУТ.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'БУНКЕР' })).toBeInTheDocument();
    expect(screen.getByText('ВРЕМЯ ДО ПРИБЫТИЯ')).toBeInTheDocument();
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('30:00');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('29:59');
  });

  it('keeps the alarm schedule active even when initial browser audio arming is blocked', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T18:00:00.000Z'));

    const arm = vi.fn().mockResolvedValue(false);
    const startAlarm = vi.fn();
    const dependencies: BunkerScreenGuardDependencies = {
      load: vi.fn().mockResolvedValue({
        status: 'active',
        startedAt: '2026-08-30T18:00:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 1800,
        soundEnabled: true,
        serverNow: '2026-08-30T18:00:00.000Z',
      }),
      audio: {
        arm,
        startAlarm,
        stopAlarm: vi.fn(),
        startAmbience: vi.fn(),
        stopAmbience: vi.fn(),
        playDoorUnlock: vi.fn(),
        dispose: vi.fn(),
      },
    };

    render(
      <BunkerScreenGuard dependencies={dependencies}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(startAlarm).toHaveBeenCalledTimes(1);
    expect(arm).toHaveBeenCalled();
    expect(screen.getByTestId('bunker-emergency-scene')).toBeInTheDocument();
  });

  it('stays on the protected bunker scene at 00:00 until the owner explicitly stops it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T18:30:05.000Z'));

    const stopAlarm = vi.fn();
    const startAlarm = vi.fn();
    const dependencies: BunkerScreenGuardDependencies = {
      load: vi.fn().mockResolvedValue({
        status: 'active',
        startedAt: '2026-08-30T18:00:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 0,
        soundEnabled: true,
        serverNow: '2026-08-30T18:30:05.000Z',
      }),
      audio: {
        arm: vi.fn().mockResolvedValue(true),
        startAlarm,
        stopAlarm,
        startAmbience: vi.fn(),
        stopAmbience: vi.fn(),
        playDoorUnlock: vi.fn(),
        dispose: vi.fn(),
      },
    };

    render(
      <BunkerScreenGuard dependencies={dependencies}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.getByTestId('bunker-emergency-scene')).toBeInTheDocument();
    expect(screen.getByText('ПРИБЫТИЕ · БУНКЕР')).toBeInTheDocument();
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('00:00');
    expect(startAlarm).not.toHaveBeenCalled();
    expect(stopAlarm).toHaveBeenCalled();
  });

  it('polls the server while active so a reset exits emergency even if realtime refresh was lost', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T18:00:00.000Z'));

    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'active',
        startedAt: '2026-08-30T18:00:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 1800,
        soundEnabled: false,
        serverNow: '2026-08-30T18:00:00.000Z',
      })
      .mockResolvedValue({
        status: 'idle',
        serverNow: '2026-08-30T18:00:02.000Z',
      });

    render(
      <BunkerScreenGuard dependencies={{ load }}>
        <div>ОБЫЧНЫЙ ЭКРАН</div>
      </BunkerScreenGuard>,
    );
    await flushLoadedState();

    expect(screen.getByTestId('bunker-emergency-scene')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('bunker-emergency-scene')).not.toBeInTheDocument();
    expect(screen.getByText('ОБЫЧНЫЙ ЭКРАН')).toBeInTheDocument();
  });
});
