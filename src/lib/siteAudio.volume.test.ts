import { describe, expect, it, vi } from 'vitest';
import { createSiteAudioController, type SiteAudioContextLike } from './siteAudio';

function fakeAudioContext() {
  const ramps: number[] = [];
  const context: SiteAudioContextLike = {
    currentTime: 2,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: () => ({
      type: 'sine' as OscillatorType,
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    }),
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn((value: number) => ramps.push(value)),
      },
      connect: vi.fn(),
    }),
  };
  return { context, ramps };
}

describe('siteAudio volume', () => {
  it('defaults to 75%, persists volume, scales cues and treats mute as silence', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    const { context, ramps } = fakeAudioContext();
    const audio = createSiteAudioController({ factory: () => context, storage });

    expect(audio.isEnabled()).toBe(true);
    expect(audio.getVolume()).toBe(0.75);

    audio.setVolume(0.3);
    expect(audio.getVolume()).toBe(0.3);
    expect(storage.setItem).toHaveBeenCalledWith('love-story-live:sound-volume', '0.3');

    expect(await audio.arm()).toBe(true);
    expect(audio.play('tap')).toBe(true);
    expect(ramps.some((value) => Math.abs(value - 0.011 * 0.3) < 0.000001)).toBe(true);

    audio.setEnabled(false);
    expect(audio.play('impact')).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith('love-story-live:sound-enabled', 'off');

    audio.setEnabled(true);
    audio.setVolume(0);
    expect(await audio.arm()).toBe(false);
    expect(audio.play('tap')).toBe(false);
  });
});
