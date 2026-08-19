import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PremiereScreenState } from '../premiere/premiere.service';
import { ScreenPage } from './ScreenPage';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

const serverNow = '2026-08-30T12:00:00.000Z';

const countdownState: PremiereScreenState = {
  status: 'countdown',
  mediaUrl: 'https://cdn.test/ring.mp4',
  durationSeconds: 623,
  startAt: '2026-08-30T12:00:10.000Z',
  playbackAnchorAt: null,
  playbackOffsetSeconds: 0,
  positionSeconds: 0,
  countdownSeconds: 10,
  countdownSoundEnabled: true,
  serverNow,
};

const standbyState: PremiereScreenState = {
  ...countdownState,
  status: 'standby',
  startAt: null,
};

const anna: ScreenPresentationEvent = {
  id: 'arrival-during-premiere',
  kind: 'guest_registered',
  createdAt: '2026-08-30T12:00:01+05:00',
  payload: {
    displayName: 'Анна Смирнова',
    carriage: {
      id: 'c4',
      number: 4,
      label: 'ВАГОН №4',
      accentHex: '#78806A',
      visualMark: '04',
    },
  },
};

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ScreenPage premiere protection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(serverNow));
  });

  afterEach(() => vi.useRealTimers());

  it('replaces the normal screen with the authoritative premiere countdown and suppresses arrival scenes', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const playArrivalSignal = vi.fn();
    const playPremiereCountdownTick = vi.fn();
    const dependencies = {
      subscribe: (callback: (event: ScreenPresentationEvent) => void) => {
        pushEvent = callback;
        return vi.fn();
      },
      loadPremiere: vi.fn().mockResolvedValue(countdownState),
      subscribeToPremiereRefresh: vi.fn(() => vi.fn()),
      playArrivalSignal,
      playPremiereCountdownTick,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(screen.getByText('ПРЕМЬЕРА ЧЕРЕЗ')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByTestId('registration-qr')).not.toBeInTheDocument();
    expect(playPremiereCountdownTick).toHaveBeenCalledWith(10);

    act(() => pushEvent?.(anna));

    expect(screen.queryByRole('heading', { name: 'Анна Смирнова' })).not.toBeInTheDocument();
    expect(playArrivalSignal).not.toHaveBeenCalled();
  });

  it('drops events received during a protected black frame instead of replaying them after return to idle', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    let refresh: (() => void) | undefined;
    const loadPremiere = vi
      .fn()
      .mockResolvedValueOnce({ status: 'black', serverNow } satisfies PremiereScreenState)
      .mockResolvedValueOnce({ status: 'idle', serverNow } satisfies PremiereScreenState);
    const dependencies = {
      subscribe: (callback: (event: ScreenPresentationEvent) => void) => {
        pushEvent = callback;
        return vi.fn();
      },
      loadPremiere,
      subscribeToPremiereRefresh: (callback: () => void) => {
        refresh = callback;
        return vi.fn();
      },
      playArrivalSignal: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(screen.getByTestId('premiere-black')).toBeInTheDocument();
    act(() => pushEvent?.(anna));
    expect(screen.queryByRole('heading', { name: 'Анна Смирнова' })).not.toBeInTheDocument();

    act(() => refresh?.());
    await flushPromises();

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Анна Смирнова' })).not.toBeInTheDocument();
    expect(dependencies.playArrivalSignal).not.toHaveBeenCalled();
  });

  it('auto-arms normal and premiere audio together and lets the operator mute the screen', async () => {
    const armArrivalAudio = vi.fn().mockResolvedValue(true);
    const armPremiereAudio = vi.fn().mockResolvedValue(true);
    const stopArrivalAudio = vi.fn();
    const dependencies = {
      subscribe: () => vi.fn(),
      loadPremiere: vi.fn().mockResolvedValue(standbyState),
      subscribeToPremiereRefresh: vi.fn(() => vi.fn()),
      armArrivalAudio,
      armPremiereAudio,
      playArrivalSignal: vi.fn(),
      stopArrivalAudio,
      playPremiereCountdownTick: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );
    await flushPromises();

    expect(armArrivalAudio).toHaveBeenCalledTimes(1);
    expect(armPremiereAudio).toHaveBeenCalledTimes(1);
    const button = screen.getByRole('button', { name: 'ВЫКЛЮЧИТЬ ЗВУК' });

    fireEvent.click(button);
    expect(stopArrivalAudio).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'ВКЛЮЧИТЬ ЗВУК' })).toBeInTheDocument();
  });
});
