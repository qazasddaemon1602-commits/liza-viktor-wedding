import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteAudio } from '../../../lib/siteAudio';
import { LizaRevealScreen } from './LizaRevealScreen';

describe('LizaRevealScreen', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    siteAudio.setEnabled(true);
    siteAudio.setVolume(0.75);
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
    expect(screen.getByRole('img')).toHaveAttribute('width', '1122');
    expect(screen.getByRole('img')).toHaveAttribute('height', '1402');

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

  it('respects global mute without consuming the sequence before sound is enabled', () => {
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
    muted.rerender(
      <LizaRevealScreen
        sessionKey="event:muted-run"
        soundEnabled
        audio={{ playDoor: mutedDoor, playReveal: mutedReveal }}
      />,
    );
    expect(mutedDoor).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1_600));
    expect(mutedReveal).toHaveBeenCalledTimes(1);
  });

  it('waits for the local projector sound preference before consuming either phase', () => {
    vi.useFakeTimers();
    siteAudio.setEnabled(false);
    const playDoor = vi.fn();
    const playReveal = vi.fn();
    render(
      <LizaRevealScreen
        sessionKey="event:local-muted-run"
        soundEnabled
        audio={{ playDoor, playReveal }}
      />,
    );
    act(() => vi.advanceTimersByTime(2_000));
    expect(playDoor).not.toHaveBeenCalled();
    expect(playReveal).not.toHaveBeenCalled();

    act(() => siteAudio.setEnabled(true));
    expect(playDoor).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1_600));
    expect(playReveal).toHaveBeenCalledTimes(1);
  });

  it('finishes the reveal exactly once after an unmount between the two cues', () => {
    vi.useFakeTimers();
    const playDoor = vi.fn();
    const playReveal = vi.fn();
    const audio = { playDoor, playReveal };
    const interrupted = render(
      <LizaRevealScreen
        sessionKey="event:interrupted-run"
        soundEnabled
        audio={audio}
      />,
    );
    expect(playDoor).toHaveBeenCalledTimes(1);
    interrupted.unmount();
    act(() => vi.advanceTimersByTime(2_000));
    expect(playReveal).not.toHaveBeenCalled();

    render(
      <LizaRevealScreen
        sessionKey="event:interrupted-run"
        soundEnabled
        audio={audio}
      />,
    );
    expect(playDoor).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1_600));
    expect(playReveal).toHaveBeenCalledTimes(1);

    const completed = render(
      <LizaRevealScreen
        sessionKey="event:interrupted-run"
        soundEnabled
        audio={audio}
      />,
    );
    act(() => vi.advanceTimersByTime(1_600));
    expect(playDoor).toHaveBeenCalledTimes(1);
    expect(playReveal).toHaveBeenCalledTimes(1);
    completed.unmount();
  });

  it('remains replay-safe through StrictMode cleanup when sessionStorage is unavailable', () => {
    vi.useFakeTimers();
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const playDoor = vi.fn();
    const playReveal = vi.fn();

    try {
      render(
        <StrictMode>
          <LizaRevealScreen
            sessionKey="event:strict-storage-run"
            soundEnabled
            audio={{ playDoor, playReveal }}
          />
        </StrictMode>,
      );
      expect(playDoor).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1_600));
      expect(playReveal).toHaveBeenCalledTimes(1);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
