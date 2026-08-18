import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
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

describe('ScreenPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows registration events sequentially and returns to the idle QR screen', async () => {
    let pushEvent: ((event: GuestRegistrationScreenEvent) => void) | undefined;
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

  it('deduplicates the same realtime event id', async () => {
    let pushEvent: ((event: GuestRegistrationScreenEvent) => void) | undefined;
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

  it('asks for one local interaction to arm projector audio, then hides the control', async () => {
    const armArrivalAudio = vi.fn().mockResolvedValue(true);
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      armArrivalAudio,
      playArrivalSignal: vi.fn(),
    };

    render(
      <ScreenPage
        joinUrl="https://wedding.example/join"
        eventSlug="liza-viktor"
        dependencies={dependencies}
      />,
    );

    const button = screen.getByRole('button', { name: 'ВКЛЮЧИТЬ ЗВУК' });
    fireEvent.click(button);

    await act(async () => {
      await Promise.resolve();
    });

    expect(armArrivalAudio).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'ВКЛЮЧИТЬ ЗВУК' })).not.toBeInTheDocument();
  });
});
