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
  it('arms both acquired-sample and pending fallback paths from the same gesture', async () => {
    const { context, starts } = fakeAudioContext();
    context.state = 'suspended';
    context.resume = vi.fn(async () => { context.state = 'running'; });
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
      setMasterVolume: vi.fn(),
      setMuted: vi.fn(),
    };
    const audio = createSiteAudioController({
      factory: () => context,
      storage: null,
      samplePlayer,
      hasSample: (id) => id === 'ui.tap',
    });

    await expect(audio.arm()).resolves.toBe(true);
    expect(samplePlayer.arm).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.isArmed()).toBe(true);
    expect(audio.play('tap')).toBe(true);
    expect(samplePlayer.playCue).toHaveBeenCalledWith('ui.tap', { priority: 'ui' });
    expect(starts).toHaveLength(0);
  });

  it('does not report a local cue playable when only the fallback path armed', async () => {
    const { context, starts } = fakeAudioContext();
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(false),
      playCue: vi.fn().mockResolvedValue('failed'),
      stopCue: vi.fn(),
      setMasterVolume: vi.fn(),
      setMuted: vi.fn(),
    };
    const audio = createSiteAudioController({
      factory: () => context,
      storage: null,
      samplePlayer,
      hasSample: (id) => id === 'ui.tap',
      now: () => 1_000,
    });

    await expect(audio.arm()).resolves.toBe(true);
    expect(audio.play('tap')).toBe(false);
    expect(samplePlayer.playCue).not.toHaveBeenCalled();
    expect(audio.play('select')).toBe(true);
    expect(starts.length).toBeGreaterThan(0);
  });

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
      hasSample: () => false,
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

