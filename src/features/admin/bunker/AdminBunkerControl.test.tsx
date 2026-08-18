import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminBunkerControl, type AdminBunkerControlDependencies } from './AdminBunkerControl';

function dependencies(overrides: Partial<AdminBunkerControlDependencies> = {}): AdminBunkerControlDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'idle',
      durationSeconds: 1800,
      soundEnabled: true,
      serverNow: '2026-08-30T12:00:00.000Z',
    }),
    start: vi.fn().mockResolvedValue({ status: 'active' }),
    stop: vi.fn().mockResolvedValue({ status: 'idle' }),
    setSound: vi.fn().mockResolvedValue({ status: 'updated' }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AdminBunkerControl', () => {
  it('requires a deliberate second confirmation before starting the 30 minute emergency', async () => {
    const user = userEvent.setup();
    const start = vi.fn().mockResolvedValue({ status: 'active' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1800, soundEnabled: true, serverNow: '2026-08-30T12:00:00.000Z',
      });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({ start, broadcastRefresh, load })}
      />,
    );

    await screen.findByRole('heading', { name: 'БУНКЕР' });
    expect(start).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    expect(screen.getByText('ВСЕ ЭКРАНЫ ПЕРЕКЛЮЧАТСЯ СРАЗУ')).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(start).toHaveBeenCalledWith('event-1', 1800);
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
  });

  it('stops an active bunker and broadcasts the screen refresh', async () => {
    const user = userEvent.setup();
    const stop = vi.fn().mockResolvedValue({ status: 'idle' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1700, soundEnabled: true, serverNow: '2026-08-30T12:01:40.000Z',
      })
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:01:41.000Z',
      });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({ stop, broadcastRefresh, load })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' }));

    expect(stop).toHaveBeenCalledWith('event-1');
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' })).toBeInTheDocument();
  });
});
