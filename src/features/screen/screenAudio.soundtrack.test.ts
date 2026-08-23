import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { siteAudio } from '../../lib/siteAudio';
import { createScreenAudioController } from './screenAudio';

function fakeAudioContext() {
  const oscillators: Array<{
    type: OscillatorType;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }> = [];
  const gains: Array<{
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
  }> = [];
  const context = {
    currentTime: 10,
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }),
    close: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => {
      const gain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
      gains.push(gain);
      return gain;
    }),
  };
  return { context, oscillators, gains };
}

describe('projector soundtrack transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    siteAudio.setEnabled(true);
    siteAudio.setVolume(0.75);
  });

  afterEach(() => {
    vi.useRealTimers();
    siteAudio.setEnabled(true);
    siteAudio.setVolume(0.75);
  });

  it('fades between server-stage themes instead of hard-cutting scheduled music', async () => {
    const { context, oscillators, gains } = fakeAudioContext();
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      preloadCue: vi.fn().mockResolvedValue({ duration: 1 }),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createScreenAudioController(() => context, samplePlayer, () => true);

    audio.setSoundtrackTheme('celebration');
    await vi.advanceTimersByTimeAsync(1);
    expect(oscillators.length).toBeGreaterThan(0);
    const notesBeforeTransition = oscillators.length;

    audio.setSoundtrackTheme('game');
    expect(gains.some((gain) => gain.gain.linearRampToValueAtTime.mock.calls.some(([value]) => value === 0.0001))).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(oscillators).toHaveLength(notesBeforeTransition);

    await vi.advanceTimersByTimeAsync(350);
    expect(oscillators.length).toBeGreaterThan(notesBeforeTransition);
    audio.dispose();
  });

  it('removes the gloomy Bunker ambience when the festive heist soundtrack takes over', () => {
    const { context } = fakeAudioContext();
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      preloadCue: vi.fn().mockResolvedValue({ duration: 1 }),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createScreenAudioController(() => context, samplePlayer, () => true);

    audio.setSoundtrackTheme('heist');

    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.ambience');
    audio.dispose();
  });
});
