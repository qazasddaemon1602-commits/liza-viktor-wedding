import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OwnerPremiereControl } from '../../premiere/premiere.service';
import {
  AdminPremiereControl,
  type AdminPremiereControlDependencies,
} from './AdminPremiereControl';

const eventId = '11111111-1111-1111-1111-111111111111';

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
  serverNow: '2026-08-30T12:00:00.000Z',
};

function dependencies(): AdminPremiereControlDependencies {
  return {
    load: vi.fn().mockResolvedValue(standbyState),
    setMedia: vi.fn().mockResolvedValue({}),
    standby: vi.fn().mockResolvedValue({}),
    start: vi.fn().mockResolvedValue({ status: 'countdown' }),
    cancel: vi.fn().mockResolvedValue({}),
    pause: vi.fn().mockResolvedValue({}),
    resume: vi.fn().mockResolvedValue({}),
    seek: vi.fn().mockResolvedValue({}),
    restart: vi.fn().mockResolvedValue({}),
    black: vi.fn().mockResolvedValue({}),
    returnMain: vi.fn().mockResolvedValue({}),
    setCountdownSound: vi.fn().mockResolvedValue({}),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
    // Presence subscription exists, but no screen has reported in: projector/video/audio are all false.
    subscribeScreenPresence: () => () => undefined,
  };
}

describe('AdminPremiereControl advisory readiness', () => {
  it('allows the owner to start with zero connected/ready screens', async () => {
    const deps = dependencies();
    render(
      <AdminPremiereControl
        eventId={eventId}
        registeredCount={0}
        expectedGuestCount={40}
        lastRegisteredAt={null}
        dependencies={deps}
      />,
    );

    const start = await screen.findByRole('button', { name: 'НАЧАТЬ ПРЕМЬЕРУ' });
    expect(start).toBeEnabled();
    expect(screen.getByText('ИНДИКАЦИЯ · НЕ БЛОКИРУЕТ ЗАПУСК. Момент старта всегда выбирает владелец вручную.')).toBeInTheDocument();
    expect(screen.queryByText(/СТАРТ ЗАБЛОКИРОВАН/i)).not.toBeInTheDocument();

    fireEvent.click(start);
    await waitFor(() => expect(deps.start).toHaveBeenCalledWith(eventId, 10));
  });
});
