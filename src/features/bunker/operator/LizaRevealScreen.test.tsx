import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LizaRevealScreen } from './LizaRevealScreen';

describe('LizaRevealScreen', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals Liza accessibly and keeps the complete story when the future portrait is unavailable', () => {
    render(<LizaRevealScreen />);
    const reveal = screen.getByRole('region', { name: 'Лиза встречает поезд · общий экран' });
    expect(reveal).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
    expect(screen.getByRole('img', { name: 'Лиза встречает прибывший поезд у открытого Бункера' })).toHaveAttribute(
      'src',
      '/images/bunker/story/liza-reveal.webp',
    );

    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(reveal).toHaveTextContent('Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза');
  });

  it('plays the door before the reveal once per run', () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const audio = {
      playDoor: () => order.push('door'),
      playReveal: () => order.push('reveal'),
    };
    const first = render(
      <LizaRevealScreen sessionKey="event:run-1" soundEnabled audio={audio} />,
    );

    expect(order).toEqual(['door']);
    act(() => vi.advanceTimersByTime(1_599));
    expect(order).toEqual(['door']);
    act(() => vi.advanceTimersByTime(1));
    expect(order).toEqual(['door', 'reveal']);

    first.unmount();
    render(<LizaRevealScreen sessionKey="event:run-1" soundEnabled audio={audio} />);
    act(() => vi.advanceTimersByTime(1_600));
    expect(order).toEqual(['door', 'reveal']);

    render(<LizaRevealScreen sessionKey="event:run-2" soundEnabled audio={audio} />);
    expect(order).toEqual(['door', 'reveal', 'door']);
  });

  it('respects global mute and clears a pending reveal cue on unmount', () => {
    vi.useFakeTimers();
    const mutedDoor = vi.fn();
    const mutedReveal = vi.fn();
    const muted = render(
      <LizaRevealScreen
        sessionKey="event:muted-run"
        soundEnabled={false}
        audio={{ playDoor: mutedDoor, playReveal: mutedReveal }}
      />,
    );
    act(() => vi.advanceTimersByTime(2_000));
    expect(mutedDoor).not.toHaveBeenCalled();
    expect(mutedReveal).not.toHaveBeenCalled();
    muted.unmount();

    const playDoor = vi.fn();
    const playReveal = vi.fn();
    const audible = render(
      <LizaRevealScreen
        sessionKey="event:cleanup-run"
        soundEnabled
        audio={{ playDoor, playReveal }}
      />,
    );
    expect(playDoor).toHaveBeenCalledTimes(1);
    audible.unmount();
    act(() => vi.advanceTimersByTime(2_000));
    expect(playReveal).not.toHaveBeenCalled();
  });
});
