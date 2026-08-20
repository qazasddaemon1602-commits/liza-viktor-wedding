import { describe, expect, it, vi } from 'vitest';
import { playWithMutedFallback } from './mediaPlayback';

describe('playWithMutedFallback', () => {
  it('retries muted when audible autoplay is rejected with NotAllowedError', async () => {
    const play = vi.fn()
      .mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'))
      .mockResolvedValueOnce(undefined);
    const media = { muted: false, play } as unknown as HTMLMediaElement;
    const onMutedFallback = vi.fn();

    await expect(playWithMutedFallback(media, onMutedFallback)).resolves.toBe('muted');

    expect(play).toHaveBeenCalledTimes(2);
    expect(media.muted).toBe(true);
    expect(onMutedFallback).toHaveBeenCalledTimes(1);
  });

  it('does not convert transient playback errors into a muted autoplay fallback', async () => {
    const error = new DOMException('Playback interrupted', 'AbortError');
    const play = vi.fn().mockRejectedValue(error);
    const media = { muted: false, play } as unknown as HTMLMediaElement;
    const onMutedFallback = vi.fn();

    await expect(playWithMutedFallback(media, onMutedFallback)).rejects.toBe(error);

    expect(play).toHaveBeenCalledTimes(1);
    expect(media.muted).toBe(false);
    expect(onMutedFallback).not.toHaveBeenCalled();
  });

  it('does not hide a real playback failure when media is already muted', async () => {
    const error = new DOMException('Media failed', 'NotSupportedError');
    const play = vi.fn().mockRejectedValue(error);
    const media = { muted: true, play } as unknown as HTMLMediaElement;

    await expect(playWithMutedFallback(media)).rejects.toBe(error);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
