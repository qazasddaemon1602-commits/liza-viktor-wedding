import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BunkerOperatorTransmission } from './BunkerOperatorTransmission';
import type { BunkerOperatorMessage } from './useBunkerOperatorFeed';

const selected: BunkerOperatorMessage = {
  id: 'd0df34d4-40bf-4c50-aee5-c3b459bf93bf',
  stage: 'MISSION_02',
  body: 'Сигнал слабый, но я вас слышу. Продолжайте.',
  source: 'selected',
  publishedAt: '2026-08-23T12:00:06.000Z',
};

const fallback: BunkerOperatorMessage = {
  id: 'a9ae29ec-ddea-4b39-ab32-80a97be57b86',
  stage: 'MISSION_04',
  body: 'Один вагон не дойдёт. Держите связь.',
  source: 'fallback',
  publishedAt: '2026-08-23T12:05:45.000Z',
};

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('BunkerOperatorTransmission projector', () => {
  it('shows each unseen transmission for eight seconds and queues a later one until dismissal', () => {
    vi.useFakeTimers();
    const playSignal = vi.fn();
    const { rerender } = render(
      <BunkerOperatorTransmission variant="projector" message={selected} soundEnabled playSignal={playSignal} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('ВХОДЯЩИЙ СИГНАЛ · ОПЕРАТОР BK-17');
    expect(screen.getByRole('status')).toHaveTextContent(selected.body);
    expect(playSignal).toHaveBeenCalledTimes(1);

    rerender(
      <BunkerOperatorTransmission variant="projector" message={fallback} soundEnabled playSignal={playSignal} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(selected.body);

    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByRole('status')).toHaveTextContent(fallback.body);
    expect(playSignal).toHaveBeenCalledTimes(2);

    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not replay a viewed id after remount and keeps the same duration without decorative motion', () => {
    vi.useFakeTimers();
    const first = render(
      <BunkerOperatorTransmission variant="projector" message={selected} motionPreference="reduced" />,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('data-motion', 'reduced');
    expect(region.querySelector('[data-transmission-scan]')).not.toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(7_999); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    first.unmount();

    render(<BunkerOperatorTransmission variant="projector" message={selected} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('plays no signal when global sound is disabled', () => {
    const playSignal = vi.fn();
    render(
      <BunkerOperatorTransmission variant="projector" message={selected} soundEnabled={false} playSignal={playSignal} />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(playSignal).not.toHaveBeenCalled();
  });
});

describe('BunkerOperatorTransmission phone', () => {
  it('keeps the latest transmission visible and labels a deterministic fallback honestly', () => {
    const { rerender } = render(<BunkerOperatorTransmission variant="phone" message={fallback} />);
    expect(screen.getByRole('note', { name: 'Последняя передача оператора BK-17' })).toHaveTextContent(
      'РЕЗЕРВНЫЙ СИГНАЛ',
    );
    expect(screen.getByRole('note')).toHaveTextContent(fallback.body);

    rerender(<BunkerOperatorTransmission variant="phone" message={selected} />);
    expect(screen.getByRole('note')).toHaveTextContent('ПЕРЕДАНО ОПЕРАТОРОМ');
    expect(screen.getByRole('note')).toHaveTextContent(selected.body);
  });
});
