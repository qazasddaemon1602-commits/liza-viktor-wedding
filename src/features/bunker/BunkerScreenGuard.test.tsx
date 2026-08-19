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
    expect(arm).toHaveBeenCalledTimes(1);
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
