import { describe, expect, it, vi } from 'vitest';
import { createSiteAudioController, type SiteAudioContextLike } from './siteAudio';

function fakeAudioContext() {
  const starts: number[] = [];
  const oscillator = () => ({
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn((when?: number) => { starts.push(when ?? 0); }),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  });
  const gain = () => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  });

  const context: SiteAudioContextLike = {
    currentTime: 1,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: oscillator,
    createGain: gain,
  };

  return { context, starts };
}

describe('siteAudio', () => {
  it('defaults on, respects mute, and suppresses UI cues during a major scene', async () => {
    const { context, starts } = fakeAudioContext();
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };
    const audio = createSiteAudioController({
      factory: () => context,
      storage,
      now: () => 1000,
    });

    expect(audio.isEnabled()).toBe(true);
    expect(await audio.arm()).toBe(true);
    expect(audio.play('tap')).toBe(true);
    expect(starts.length).toBeGreaterThan(0);

    audio.beginPriority('major');
    expect(audio.play('tap')).toBe(false);
    audio.endPriority('major');

    audio.setEnabled(false);
    expect(audio.isEnabled()).toBe(false);
    expect(audio.play('impact')).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith('love-story-live:sound-enabled', 'off');
  });
});
