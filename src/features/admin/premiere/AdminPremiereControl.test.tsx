import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OwnerPremiereControl } from '../../premiere/premiere.service';
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

const countdownState: OwnerPremiereControl = {
  ...standbyState,
  status: 'countdown',
  startAt: '2026-08-30T12:00:10.000Z',
};

const playingState: OwnerPremiereControl = {
  ...standbyState,
  status: 'playing',
  playbackAnchorAt: serverNow,
  positionSeconds: 152,
};

function dependencies(state: OwnerPremiereControl): AdminPremiereControlDependencies {
  return {
    load: vi.fn().mockResolvedValue(state),
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
  };
}

describe('AdminPremiereControl', () => {
  it('shows a simple manual start path once the video is configured and in standby', async () => {
    const deps = dependencies(standbyState);
    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={32}
        expectedGuestCount={40}
        lastRegisteredAt="2026-08-30T11:53:00.000Z"
        projectorConnected
        audioArmed
        nowMs={Date.parse(serverNow)}
        dependencies={deps}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'КОЛЬЦО · РЕЖИССЁРСКИЙ ПУЛЬТ' })).toBeInTheDocument();
    expect(screen.getByText('32 / ~40')).toBeInTheDocument();
    expect(screen.getByText('ПРЕМЬЕРА ГОТОВА')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'НАЧАТЬ ПРЕМЬЕРУ' })).toBeInTheDocument();
  });

  it('configures the deploy-safe video URL and refreshes all projector screens', async () => {
    const unconfigured: OwnerPremiereControl = {
      status: 'idle',
      configured: false,
      serverNow,
      countdownSoundEnabled: true,
      countdownSeconds: 10,
    };
    const deps = dependencies(unconfigured);
    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={0}
        expectedGuestCount={40}
        lastRegisteredAt={null}
        dependencies={deps}
      />,
    );

    fireEvent.change(await screen.findByLabelText('Ссылка на видео'), {
      target: { value: 'https://cdn.test/ring.mp4' },
    });
    fireEvent.change(screen.getByLabelText('Длительность, сек'), {
      target: { value: '623' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'СОХРАНИТЬ ВИДЕО' }));

    await waitFor(() => {
      expect(deps.setMedia).toHaveBeenCalledWith(eventId, 'https://cdn.test/ring.mp4', 623);
      expect(deps.broadcastRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('starts a manual ten-second countdown and broadcasts the new state', async () => {
    const deps = dependencies(standbyState);
    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={32}
        expectedGuestCount={40}
        lastRegisteredAt="2026-08-30T11:53:00.000Z"
        projectorConnected
        audioArmed
        nowMs={Date.parse(serverNow)}
        dependencies={deps}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'НАЧАТЬ ПРЕМЬЕРУ' }));

    await waitFor(() => {
      expect(deps.start).toHaveBeenCalledWith(eventId, 10);
      expect(deps.broadcastRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('does not invite a duplicate start when RPC succeeds but realtime refresh fails', async () => {
    const deps = dependencies(standbyState);
    deps.load = vi.fn()
      .mockResolvedValueOnce(standbyState)
      .mockResolvedValue(countdownState);
    deps.broadcastRefresh = vi.fn()
      .mockRejectedValueOnce(new Error('realtime offline'))
      .mockResolvedValue(undefined);

    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={32}
        expectedGuestCount={40}
        lastRegisteredAt="2026-08-30T11:53:00.000Z"
        projectorConnected
        audioArmed
        nowMs={Date.parse(serverNow)}
        dependencies={deps}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'НАЧАТЬ ПРЕМЬЕРУ' }));

    expect(await screen.findByText(/КОМАНДА ВЫПОЛНЕНА/i)).toBeInTheDocument();
    expect(screen.getByText('ИДЁТ ОТСЧЁТ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'НАЧАТЬ ПРЕМЬЕРУ' })).not.toBeInTheDocument();
    expect(deps.start).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'ПОВТОРИТЬ СИНХРОНИЗАЦИЮ' }));

    await waitFor(() => {
      expect(deps.broadcastRefresh).toHaveBeenCalledTimes(2);
    });
    expect(deps.start).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'ПОВТОРИТЬ СИНХРОНИЗАЦИЮ' })).not.toBeInTheDocument();
  });

  it('exposes pause and ±5 second recovery controls while the track is playing', async () => {
    const deps = dependencies(playingState);
    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={32}
        expectedGuestCount={40}
        lastRegisteredAt="2026-08-30T11:53:00.000Z"
        dependencies={deps}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'ПАУЗА' }));
    await waitFor(() => expect(deps.pause).toHaveBeenCalledWith(eventId));

    fireEvent.click(screen.getByRole('button', { name: '−5 СЕК' }));
    await waitFor(() => expect(deps.seek).toHaveBeenCalledWith(eventId, 147));

    fireEvent.click(screen.getByRole('button', { name: '+5 СЕК' }));
    await waitFor(() => expect(deps.seek).toHaveBeenCalledWith(eventId, 157));

    expect(screen.getByRole('button', { name: 'С НАЧАЛА' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ЧЁРНЫЙ ЭКРАН' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ГЛАВНЫЙ ЭКРАН' })).toBeInTheDocument();
  });
});
