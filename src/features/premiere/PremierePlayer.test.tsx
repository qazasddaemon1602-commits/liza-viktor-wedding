import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PremierePlayer } from './PremierePlayer';

const play = vi.fn<() => Promise<void>>();
const pause = vi.fn<() => void>();

describe('PremierePlayer', () => {
  beforeEach(() => {
    play.mockReset();
    play.mockResolvedValue(undefined);
    pause.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preloads the configured video while waiting for the authoritative start', () => {
    const { container } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay={false} />,
    );

    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', 'https://cdn.test/ring.mp4');
    expect(video).toHaveAttribute('preload', 'auto');
    expect(play).not.toHaveBeenCalled();
  });

  it('calls play exactly once when shouldPlay flips true', () => {
    const { rerender } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay={false} />,
    );

    rerender(<PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />);
    expect(play).toHaveBeenCalledTimes(1);

    rerender(<PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('resets the one-shot play guard when a different premiere source is loaded', () => {
    const { rerender } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />,
    );
    expect(play).toHaveBeenCalledTimes(1);

    rerender(<PremierePlayer src="https://cdn.test/ring-v2.mp4" shouldPlay />);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('reports the video end to the orchestration layer', () => {
    const ended = vi.fn();
    const { container } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay onEnded={ended} />,
    );

    fireEvent.ended(container.querySelector('video')!);
    expect(ended).toHaveBeenCalledTimes(1);
  });
});
