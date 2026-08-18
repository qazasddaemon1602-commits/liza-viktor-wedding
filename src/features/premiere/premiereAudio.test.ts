import { describe, expect, it, vi } from 'vitest';
import {
  createPremiereAudioController,
  getCountdownCue,
  type PremiereAudioContextLike,
} from './premiereAudio';

function fakeAudioContext() {
  const frequency = { setValueAtTime: vi.fn() };
  const gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  const oscillator = {
    type: 'sine' as OscillatorType,
    frequency,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gainNode = {
    gain,
    connect: vi.fn(),
  };
  const context: PremiereAudioContextLike = {
    currentTime: 10,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gainNode),
  };
  return { context, frequency, gain, oscillator };
}

describe('premiere countdown audio', () => {
  it('never schedules a countdown cue for zero or an out-of-range second', () => {
    expect(getCountdownCue(0)).toBeNull();
    expect(getCountdownCue(-1)).toBeNull();
    expect(getCountdownCue(11)).toBeNull();
  });

  it('uses a restrained final cue for three, two and one', () => {
    expect(getCountdownCue(4)).toBe('countdown-tick');
    expect(getCountdownCue(3)).toBe('countdown-final');
    expect(getCountdownCue(2)).toBe('countdown-final');
    expect(getCountdownCue(1)).toBe('countdown-final');
  });

  it('plays a low pulse only for valid countdown seconds', () => {
    const { context, frequency, gain, oscillator } = fakeAudioContext();
    const audio = createPremiereAudioController(() => context);

    audio.playCountdownTick(0);
    expect(context.createOscillator).not.toHaveBeenCalled();

    audio.playCountdownTick(4);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(frequency.setValueAtTime).toHaveBeenLastCalledWith(110, expect.any(Number));
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.018, expect.any(Number));
    expect(oscillator.stop).toHaveBeenCalled();
  });

  it('keeps the final-three pulse slightly stronger but still restrained', () => {
    const { context, frequency, gain } = fakeAudioContext();
    const audio = createPremiereAudioController(() => context);

    audio.playCountdownTick(3);

    expect(frequency.setValueAtTime).toHaveBeenLastCalledWith(146.83, expect.any(Number));
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.028, expect.any(Number));
  });
});
