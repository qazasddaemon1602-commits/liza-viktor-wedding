import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBunkerPresentationProtected } from '../bunker/bunkerProtection';
import type { PremiereScreenState } from '../premiere/premiere.service';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

afterEach(() => {
  setBunkerPresentationProtected(false);
  vi.restoreAllMocks();
});

describe('ScreenPage bunker protection', () => {
  it('drops ordinary projector events and their audio while bunker is active', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const playArrivalSignal = vi.fn();
    const stopArrivalAudio = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushEvent = callback;
        return vi.fn();
      },
      playArrivalSignal,
      stopArrivalAudio,
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        sceneDurationMs={60_000}
        dependencies={dependencies}
      />,
    );

    act(() => setBunkerPresentationProtected(true));
    expect(stopArrivalAudio).toHaveBeenCalledTimes(1);

    act(() => {
      pushEvent?.({
        id: 'event-bunker-guest',
        kind: 'guest_registered',
        createdAt: '2026-08-30T18:00:01.000Z',
        payload: {
          displayName: 'Поздний Гость',
          carriage: {
            id: 'c1',
            number: 1,
            label: 'ВАГОН №1',
            accentHex: '#31483A',
            visualMark: '01',
          },
        },
      });
    });

    expect(screen.queryByTestId('train-arrival-scene')).not.toBeInTheDocument();
    expect(playArrivalSignal).not.toHaveBeenCalled();

    act(() => setBunkerPresentationProtected(false));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId('train-arrival-scene')).not.toBeInTheDocument();
    expect(screen.queryByText('Поздний Гость')).not.toBeInTheDocument();
  });

  it('unmounts protected premiere media during bunker and refetches authoritative state after stop', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    const playing: PremiereScreenState = {
      status: 'playing',
      mediaUrl: 'https://wedding.example/premiere.mp4',
      durationSeconds: 623,
      startAt: null,
      playbackAnchorAt: '2026-08-30T18:00:00.000Z',
      playbackOffsetSeconds: 12,
      positionSeconds: 12,
      countdownSeconds: 10,
      countdownSoundEnabled: true,
      serverNow: '2026-08-30T18:00:12.000Z',
    };
    const loadPremiere = vi.fn().mockResolvedValue(playing);
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadPremiere,
      subscribeToPremiereRefresh: () => vi.fn(),
    };

    const { container } = render(
      <ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('video.premiere-player')).toBeInTheDocument();
    const callsBeforeBunker = loadPremiere.mock.calls.length;

    act(() => setBunkerPresentationProtected(true));
    expect(container.querySelector('video.premiere-player')).not.toBeInTheDocument();

    act(() => setBunkerPresentationProtected(false));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadPremiere.mock.calls.length).toBeGreaterThan(callsBeforeBunker);
    expect(container.querySelector('video.premiere-player')).toBeInTheDocument();
  });
});
