import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PremiereScreenState } from '../../premiere/premiere.service';
import { PremiereScreen } from './PremiereScreen';

const play = vi.fn<() => Promise<void>>();
const pause = vi.fn<() => void>();

type ConfiguredPremiereState = Extract<
  PremiereScreenState,
  { status: 'standby' | 'countdown' | 'playing' | 'paused' }
>;

const base = {
  mediaUrl: 'https://cdn.test/ring.mp4',
  durationSeconds: 623,
  startAt: null,
  playbackAnchorAt: null,
  playbackOffsetSeconds: 0,
  positionSeconds: 0,
  countdownSeconds: 10,
  countdownSoundEnabled: true,
  serverNow: '2026-08-30T12:00:00.000Z',
} as const;

function state(
  status: ConfiguredPremiereState['status'],
  patch: Partial<ConfiguredPremiereState> = {},
): ConfiguredPremiereState {
  return {
    ...base,
    status,
    startAt: status === 'countdown' ? '2026-08-30T12:00:10.000Z' : null,
    playbackAnchorAt: status === 'playing' ? '2026-08-30T12:00:10.000Z' : null,
    ...patch,
  } as ConfiguredPremiereState;
}

describe('PremiereScreen', () => {
  beforeEach(() => {
    play.mockReset();
    play.mockResolvedValue(undefined);
    pause.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps the configured video preloaded behind a black standby screen', () => {
    const { container } = render(
      <PremiereScreen state={state('standby')} nowMs={Date.parse(base.serverNow)} />,
    );

    expect(screen.getByTestId('premiere-standby')).toBeInTheDocument();
    expect(container.querySelector('video')).toHaveAttribute('preload', 'auto');
    expect(container.querySelector('video')).toHaveAttribute('src', base.mediaUrl);
    expect(play).not.toHaveBeenCalled();
  });

  it('derives countdown frames from the authoritative timestamp and emits each audio cue once', () => {
    const tick = vi.fn();
    const countdown = state('countdown');
    const startMs = Date.parse(countdown.startAt!);
    const { rerender } = render(
      <PremiereScreen state={countdown} nowMs={startMs - 10_000} onCountdownTick={tick} />,
    );

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(tick).toHaveBeenCalledWith(10);

    rerender(<PremiereScreen state={countdown} nowMs={startMs - 8_999} onCountdownTick={tick} />);
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(tick).toHaveBeenCalledWith(9);

    rerender(<PremiereScreen state={countdown} nowMs={startMs - 8_999} onCountdownTick={tick} />);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('removes the countdown with no zero frame and starts the already mounted video at the boundary', () => {
    const countdown = state('countdown');
    const startMs = Date.parse(countdown.startAt!);
    const { rerender, container } = render(
      <PremiereScreen state={countdown} nowMs={startMs - 1} />,
    );

    const videoBefore = container.querySelector('video');
    expect(screen.getByText('1')).toBeInTheDocument();

    rerender(<PremiereScreen state={countdown} nowMs={startMs} />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(container.querySelector('video')).toBe(videoBefore);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('pauses the same player when server state changes from playing to paused', () => {
    const { rerender, container } = render(
      <PremiereScreen state={state('playing')} nowMs={Date.parse(base.serverNow)} />,
    );
    const videoBefore = container.querySelector('video');
    expect(play).toHaveBeenCalledTimes(1);

    rerender(<PremiereScreen state={state('paused', { positionSeconds: 18 })} nowMs={Date.parse(base.serverNow)} />);

    expect(container.querySelector('video')).toBe(videoBefore);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('renders a protected black frame without exposing the media source', () => {
    const black: PremiereScreenState = {
      status: 'black',
      serverNow: base.serverNow,
    };
    const { container } = render(<PremiereScreen state={black} nowMs={Date.parse(base.serverNow)} />);

    expect(screen.getByTestId('premiere-black')).toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });
});
