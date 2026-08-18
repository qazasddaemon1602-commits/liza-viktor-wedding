import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BunkerScreenGuard, type BunkerScreenGuardDependencies } from './BunkerScreenGuard';

afterEach(() => {
  vi.useRealTimers();
});

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

    expect(await screen.findByTestId('bunker-emergency-scene')).toBeInTheDocument();
    expect(screen.getByText('ЭКСТРЕННОЕ СООБЩЕНИЕ')).toBeInTheDocument();
    expect(screen.getByText('ПОЕЗД ИЗМЕНИЛ МАРШРУТ.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'БУНКЕР' })).toBeInTheDocument();
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('30:00');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByTestId('bunker-timer')).toHaveTextContent('29:59');
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

    expect(await screen.findByTestId('bunker-emergency-scene')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_100);
      await Promise.resolve();
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('bunker-emergency-scene')).not.toBeInTheDocument();
    expect(screen.getByText('ОБЫЧНЫЙ ЭКРАН')).toBeInTheDocument();
  });
});
