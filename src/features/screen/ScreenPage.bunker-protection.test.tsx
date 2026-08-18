import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setBunkerPresentationProtected } from '../bunker/bunkerProtection';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

afterEach(() => {
  setBunkerPresentationProtected(false);
});

describe('ScreenPage bunker protection', () => {
  it('drops ordinary projector events and their audio while bunker is active', async () => {
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
        sceneDurationMs={60_000}
        dependencies={dependencies}
      />,
    );

    act(() => setBunkerPresentationProtected(true));
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
});
