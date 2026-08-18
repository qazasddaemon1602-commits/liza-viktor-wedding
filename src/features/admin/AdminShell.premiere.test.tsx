import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OwnerPremiereControl } from '../premiere/premiere.service';
import { AdminShell, type AdminShellDependencies } from './AdminShell';
import type { AdminDashboard } from './admin.service';

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
    nextTicketSequence: 3,
  },
  state: null,
  carriages: [],
  guests: [
    {
      id: 'guest-1',
      firstName: 'Анна',
      lastName: 'Смирнова',
      affiliationType: 'liza',
      affiliationDetail: '',
      ticketNumber: '0001',
      registeredAt: '2026-08-30T11:40:00.000Z',
      lastSeenAt: '2026-08-30T11:40:00.000Z',
      carriage: {
        id: 'carriage-1',
        number: 1,
        label: 'ВАГОН №1',
        accentHex: '#78806A',
        visualMark: '01',
      },
    },
    {
      id: 'guest-2',
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'viktor',
      affiliationDetail: '',
      ticketNumber: '0002',
      registeredAt: '2026-08-30T11:53:00.000Z',
      lastSeenAt: '2026-08-30T11:53:00.000Z',
      carriage: {
        id: 'carriage-2',
        number: 2,
        label: 'ВАГОН №2',
        accentHex: '#7D6E66',
        visualMark: '02',
      },
    },
  ],
  recentActions: [],
};

const premiereState: OwnerPremiereControl = {
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

describe('AdminShell premiere controls', () => {
  it('renders the premiere director panel for the current event and passes guest timing context', async () => {
    const premiereLoad = vi.fn().mockResolvedValue(premiereState);
    const dependencies: AdminShellDependencies = {
      load: vi.fn().mockResolvedValue(dashboard),
      deleteGuest: vi.fn().mockResolvedValue(undefined),
      reassignGuest: vi.fn().mockResolvedValue(undefined),
      lockComposition: vi.fn().mockResolvedValue({ registrationOpen: true }),
      premiere: {
        load: premiereLoad,
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
      },
    };

    render(<AdminShell dependencies={dependencies} />);

    expect(await screen.findByRole('heading', { name: 'КОЛЬЦО · РЕЖИССЁРСКИЙ ПУЛЬТ' })).toBeInTheDocument();
    expect(premiereLoad).toHaveBeenCalledWith('event-1');
    const readiness = screen.getByRole('region', { name: 'Готовность премьеры' });
    expect(within(readiness).getByText('2 / ~40')).toBeInTheDocument();
  });
});
