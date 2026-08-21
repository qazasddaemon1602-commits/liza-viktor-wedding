import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
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
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('resolves a public Yandex Disk share link to a direct media href before playback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ href: 'https://downloader.disk.yandex.ru/ring.mp4' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(
      <PremierePlayer src="https://disk.yandex.ru/i/ogOrvj98Qk7bXQ" shouldPlay={false} />,
    );

    await waitFor(() => {
      expect(container.querySelector('video')).toHaveAttribute(
        'src',
        'https://downloader.disk.yandex.ru/ring.mp4',
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=',
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      encodeURIComponent('https://disk.yandex.ru/i/ogOrvj98Qk7bXQ'),
    );
  });

  it('reports video readiness only after the browser can play the preloaded media', () => {
    const ready = vi.fn();
    const { container } = render(
      <PremierePlayer
        src="https://cdn.test/ring.mp4"
        shouldPlay={false}
        onReady={ready}
      />,
    );

    expect(ready).not.toHaveBeenCalled();
    fireEvent.canPlay(container.querySelector('video')!);
    expect(ready).toHaveBeenCalledTimes(1);
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

  it('keeps one playback attempt when StrictMode replays source effects', () => {
    render(
      <StrictMode>
        <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />
      </StrictMode>,
    );

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('seeks to the authoritative position before starting a late or reconnected screen', () => {
    const { container } = render(
      <PremierePlayer
        src="https://cdn.test/ring.mp4"
        shouldPlay
        positionSeconds={152.4}
      />,
    );

    const video = container.querySelector('video')!;
    expect(video.currentTime).toBeCloseTo(152.4);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('applies a later authoritative seek without replaying the same source', () => {
    const { container, rerender } = render(
      <PremierePlayer
        src="https://cdn.test/ring.mp4"
        shouldPlay
        positionSeconds={40}
      />,
    );
    const video = container.querySelector('video')!;
    expect(video.currentTime).toBeCloseTo(40);

    rerender(
      <PremierePlayer
        src="https://cdn.test/ring.mp4"
        shouldPlay
        positionSeconds={75}
      />,
    );

    expect(video.currentTime).toBeCloseTo(75);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('pauses once when playback is stopped and can resume the same source', () => {
    const { rerender } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />,
    );
    expect(play).toHaveBeenCalledTimes(1);

    rerender(<PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay={false} />);
    expect(pause).toHaveBeenCalledTimes(1);

    rerender(<PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay={false} />);
    expect(pause).toHaveBeenCalledTimes(1);

    rerender(<PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('resets the one-shot play guard when a different premiere source is loaded', () => {
    const { rerender } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />,
    );
    expect(play).toHaveBeenCalledTimes(1);

    rerender(<PremierePlayer src="https://cdn.test/ring-v2.mp4" shouldPlay />);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('keeps replacement playback active when the previous source rejects late', async () => {
    let rejectPrevious!: (error: unknown) => void;
    play
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
        rejectPrevious = reject;
      }))
      .mockResolvedValue(undefined);

    const { rerender } = render(
      <PremierePlayer src="https://cdn.test/ring.mp4" shouldPlay />,
    );
    rerender(<PremierePlayer src="https://cdn.test/ring-v2.mp4" shouldPlay />);
    pause.mockClear();

    await act(async () => {
      rejectPrevious(new DOMException('Interrupted old source', 'AbortError'));
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender(<PremierePlayer src="https://cdn.test/ring-v2.mp4" shouldPlay={false} />);

    expect(pause).toHaveBeenCalledTimes(1);
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

