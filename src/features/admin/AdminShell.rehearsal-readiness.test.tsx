import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminShell, type AdminShellDependencies } from './AdminShell';
import type { AdminDashboard } from './admin.service';

const serverNow = '2026-08-19T03:30:00.000Z';

type ScreenPresence = {
  screenId: string;
  videoReady: boolean;
  audioArmed: boolean;
};

const dashboard: AdminDashboard = {
  status: 'owner',
  event: {
    id: 'event-1',
    slug: 'liza-viktor',
    name: 'Лиза × Виктор',
    weddingDate: '2026-08-29',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: false,
    nextTicketSequence: 1,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: serverNow,
  },
  carriages: [],
  guests: [],
  recentActions: [],
};

describe('AdminShell rehearsal readiness integration', () => {
  it('wires the owner premiere, screen presence and couple-answer status into the rehearsal panel', async () => {
    const presenceCallbacks: Array<(presence: ScreenPresence) => void> = [];

    const premiere: NonNullable<AdminShellDependencies['premiere']> = {
      load: vi.fn().mockResolvedValue({
        status: 'idle',
        configured: true,
        mediaUrl: 'https://example.com/ring.mp4',
        durationSeconds: 623,
        startAt: null,
        playbackAnchorAt: null,
        playbackOffsetSeconds: 0,
        positionSeconds: 0,
        countdownSeconds: 10,
        countdownSoundEnabled: true,
        serverNow,
      }),
      setMedia: vi.fn().mockResolvedValue(undefined),
      standby: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      black: vi.fn().mockResolvedValue(undefined),
      returnMain: vi.fn().mockResolvedValue(undefined),
      setCountdownSound: vi.fn().mockResolvedValue(undefined),
      broadcastRefresh: vi.fn().mockResolvedValue(undefined),
      subscribeScreenPresence: (callback) => {
        presenceCallbacks.push(callback);
        return () => {
          const index = presenceCallbacks.indexOf(callback);
          if (index >= 0) presenceCallbacks.splice(index, 1);
        };
      },
    };

    const couplePreanswers: NonNullable<AdminShellDependencies['couplePreanswers']> = {
      load: vi.fn().mockResolvedValue({
        status: 'finalized',
        answeredCount: 5,
        totalCount: 5,
        issuedAt: serverNow,
        finalizedAt: serverNow,
      }),
      issue: vi.fn().mockResolvedValue({ status: 'issued', token: 'token-1' }),
      buildAccessUrl: (token) => `/couple-preanswers?token=${token}`,
    };

    const dependencies: AdminShellDependencies = {
      load: vi.fn().mockResolvedValue(structuredClone(dashboard)),
      deleteGuest: vi.fn().mockResolvedValue(undefined),
      reassignGuest: vi.fn().mockResolvedValue(undefined),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
      premiere,
      couplePreanswers,
    };

    render(<AdminShell dependencies={dependencies} refreshIntervalMs={0} />);

    await screen.findByText('Лиза × Виктор');
    await waitFor(() => expect(presenceCallbacks.length).toBeGreaterThanOrEqual(2));

    act(() => {
      for (const callback of presenceCallbacks) {
        callback({ screenId: 'tv-main', videoReady: true, audioArmed: true });
        callback({ screenId: 'tv-second', videoReady: true, audioArmed: true });
      }
    });

    expect(await screen.findByText('ГОТОВО К РЕПЕТИЦИИ')).toBeInTheDocument();
  });
});
