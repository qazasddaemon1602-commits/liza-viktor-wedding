import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestProjectorAudioRearm, siteAudio } from '../../lib/siteAudio';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { ScreenPresentationEvent } from './screenEvents.realtime';
import type { GuestRegistrationScreenEvent } from './TrainArrivalScene';

const anna: GuestRegistrationScreenEvent = {
  id: 'event-anna',
  kind: 'guest_registered',
  createdAt: '2026-08-30T12:00:00+05:00',
  payload: {
    displayName: 'Анна Смирнова',
    carriage: { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
  },
};

const ivan: GuestRegistrationScreenEvent = {
  id: 'event-ivan',
  kind: 'guest_registered',
  createdAt: '2026-08-30T12:00:01+05:00',
  payload: {
    displayName: 'Иван Петров',
    carriage: { id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03' },
  },
};

const carriageCall: ScreenPresentationEvent = {
  id: 'screen-call-1',
  kind: 'carriage_call',
  createdAt: '2026-08-30T12:00:02+05:00',
  payload: {
    callId: 'call-1',
    message: 'ВАГОНЫ 2 И 4 — ГОТОВИМСЯ К СЛЕДУЮЩЕМУ КОНКУРСУ',
    carriages: [
      { id: 'c2', number: 2, label: 'ВАГОН №2', accentHex: '#9A6348', visualMark: '02' },
      { id: 'c4', number: 4, label: 'ВАГОН №4', accentHex: '#78806A', visualMark: '04' },
    ],
  },
};

describe('ScreenPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
  });

  afterEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
    vi.useRealTimers();
  });

  it('shows registration events sequentially and returns to the idle QR screen', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: vi.fn((callback) => {
        pushEvent = callback;
        return unsubscribe;
      }),
      playArrivalSignal: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();

    act(() => {
      pushEvent?.(anna);
      pushEvent?.(ivan);
    });

    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Иван Петров' })).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('heading', { name: 'Иван Петров' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByRole('heading', { name: 'Иван Петров' })).not.toBeInTheDocument();
    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(dependencies.playArrivalSignal).toHaveBeenCalledTimes(2);
  });

  it('queues owner carriage announcements after arrivals and does not play the arrival chime for them', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const playArrivalSignal = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushEvent = callback;
        return vi.fn();
      },
      playArrivalSignal,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );

    act(() => {
      pushEvent?.(anna);
      pushEvent?.(carriageCall);
    });

    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('heading', { name: carriageCall.payload.message })).toBeInTheDocument();
    expect(screen.getByText('ОБЪЯВЛЕНИЕ ПО СОСТАВУ')).toBeInTheDocument();
    expect(playArrivalSignal).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
  });

  it('deduplicates the same realtime event id', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushEvent = callback;
        return vi.fn();
      },
      playArrivalSignal: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        sceneDurationMs={1000}
        dependencies={dependencies}
      />,
    );

    act(() => {
      pushEvent?.(anna);
      pushEvent?.(anna);
    });

    expect(screen.getByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(dependencies.playArrivalSignal).toHaveBeenCalledTimes(1);
  });

  it('uses the shared projector control only and rearms scene audio after a global unmute', async () => {
    const armArrivalAudio = vi.fn().mockResolvedValue(true);
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      armArrivalAudio,
      playArrivalSignal: vi.fn(),
      stopArrivalAudio: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(armArrivalAudio).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'ВЫКЛЮЧИТЬ ЗВУК' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ВКЛЮЧИТЬ ЗВУК' })).not.toBeInTheDocument();

    await act(async () => {
      siteAudio.setEnabled(false);
      siteAudio.setEnabled(true);
      requestProjectorAudioRearm();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(armArrivalAudio).toHaveBeenCalledTimes(2);
  });
});

