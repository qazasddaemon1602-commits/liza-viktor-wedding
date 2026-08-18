import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerPremiereControl } from '../../premiere/premiere.service';
import type { PremiereScreenPresence } from '../../premiere/premierePresence.realtime';
import {
  AdminPremiereControl,
  type AdminPremiereControlDependencies,
} from './AdminPremiereControl';

const eventId = '11111111-1111-1111-1111-111111111111';
const serverNow = '2026-08-30T12:00:00.000Z';

const standbyState: OwnerPremiereControl = {
  status: 'standby',
  configured: true,
  mediaUrl: 'https://cdn.test/ring.mp4',
  durationSeconds: 623,
  startAt: null,
  playbackAnchorAt: null,
  playbackOffsetSeconds: 0,
  positionSeconds: 0,
  countdownSeconds: 10,
  countdownSoundEnabled: true,
  serverNow,
};

describe('AdminPremiereControl live projector preflight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(serverNow));
  });

  afterEach(() => vi.useRealTimers());

  it('shows two live TVs and their real video/audio readiness', async () => {
    let emit: ((presence: PremiereScreenPresence) => void) | undefined;
    const dependencies: AdminPremiereControlDependencies = {
      load: vi.fn().mockResolvedValue(standbyState),
      setMedia: vi.fn().mockResolvedValue({ status: 'configured' }),
      standby: vi.fn().mockResolvedValue({ status: 'standby' }),
      start: vi.fn().mockResolvedValue({ status: 'countdown' }),
      cancel: vi.fn().mockResolvedValue({ status: 'standby' }),
      pause: vi.fn().mockResolvedValue({ status: 'paused' }),
      resume: vi.fn().mockResolvedValue({ status: 'playing' }),
      seek: vi.fn().mockResolvedValue({ status: 'seeked' }),
      restart: vi.fn().mockResolvedValue({ status: 'playing' }),
      black: vi.fn().mockResolvedValue({ status: 'black' }),
      returnMain: vi.fn().mockResolvedValue({ status: 'idle' }),
      setCountdownSound: vi.fn().mockResolvedValue({ status: 'updated' }),
      broadcastRefresh: vi.fn().mockResolvedValue(undefined),
      subscribeScreenPresence: (callback) => {
        emit = callback;
        return vi.fn();
      },
    };

    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={32}
        expectedGuestCount={40}
        lastRegisteredAt="2026-08-30T11:53:00.000Z"
        nowMs={Date.parse(serverNow)}
        dependencies={dependencies}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'КОЛЬЦО · РЕЖИССЁРСКИЙ ПУЛЬТ' })).toBeInTheDocument();

    act(() => {
      emit?.({ screenId: 'tv-room-1', videoReady: true, audioArmed: true });
      emit?.({ screenId: 'tv-room-2', videoReady: true, audioArmed: true });
    });

    expect(screen.getByText('ЭКРАНЫ НА СВЯЗИ · 2')).toBeInTheDocument();
    expect(screen.getByText('ВИДЕО ГОТОВО · 2/2')).toBeInTheDocument();
    expect(screen.getByText('ЗВУК ГОТОВ · 2/2')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА ГОТОВА')).toBeInTheDocument();
  });

  it('marks a TV offline automatically after the heartbeat freshness window expires', async () => {
    let emit: ((presence: PremiereScreenPresence) => void) | undefined;
    const dependencies: AdminPremiereControlDependencies = {
      load: vi.fn().mockResolvedValue(standbyState),
      setMedia: vi.fn().mockResolvedValue({ status: 'configured' }),
      standby: vi.fn().mockResolvedValue({ status: 'standby' }),
      start: vi.fn().mockResolvedValue({ status: 'countdown' }),
      cancel: vi.fn().mockResolvedValue({ status: 'standby' }),
      pause: vi.fn().mockResolvedValue({ status: 'paused' }),
      resume: vi.fn().mockResolvedValue({ status: 'playing' }),
      seek: vi.fn().mockResolvedValue({ status: 'seeked' }),
      restart: vi.fn().mockResolvedValue({ status: 'playing' }),
      black: vi.fn().mockResolvedValue({ status: 'black' }),
      returnMain: vi.fn().mockResolvedValue({ status: 'idle' }),
      setCountdownSound: vi.fn().mockResolvedValue({ status: 'updated' }),
      broadcastRefresh: vi.fn().mockResolvedValue(undefined),
      subscribeScreenPresence: (callback) => {
        emit = callback;
        return vi.fn();
      },
    };

    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={32}
        expectedGuestCount={40}
        lastRegisteredAt="2026-08-30T11:53:00.000Z"
        nowMs={Date.parse(serverNow)}
        dependencies={dependencies}
      />,
    );
    expect(await screen.findByRole('heading', { name: 'КОЛЬЦО · РЕЖИССЁРСКИЙ ПУЛЬТ' })).toBeInTheDocument();

    act(() => emit?.({ screenId: 'tv-room-1', videoReady: true, audioArmed: true }));
    expect(screen.getByText('ЭКРАНЫ НА СВЯЗИ · 1')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    expect(screen.getByText('ЭКРАНЫ НА СВЯЗИ · 0')).toBeInTheDocument();
    expect(screen.getByText('ТЕХНИКА ЕЩЁ НЕ ГОТОВА')).toBeInTheDocument();
  });
});
