import { describe, expect, it, vi } from 'vitest';
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

describe('createScreenAudioController', () => {
  it('stays silent until the projector has been armed by a local interaction', () => {
    const { context } = fakeAudioContext();
    const factory = vi.fn(() => context);
    const audio = createScreenAudioController(factory);

    audio.playArrival();

    expect(factory).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it('arms once and plays a quiet two-note arrival signal', async () => {
    const { context, oscillators, gains } = fakeAudioContext();
    const factory = vi.fn(() => context);
    const audio = createScreenAudioController(factory);

    expect(await audio.arm()).toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);

    audio.playArrival();

    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    expect(context.createGain).toHaveBeenCalledTimes(2);
    expect(oscillators[0].start).toHaveBeenCalled();
    expect(oscillators[1].start).toHaveBeenCalled();
    expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(gains[1].gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('stops already scheduled arrival notes immediately without closing the armed audio context', async () => {
    const { context, oscillators } = fakeAudioContext();
    const audio = createScreenAudioController(() => context);

    await audio.arm();
    audio.playArrival();
    audio.stopArrival();

    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].stop).toHaveBeenLastCalledWith(context.currentTime);
    expect(oscillators[1].stop).toHaveBeenLastCalledWith(context.currentTime);
    expect(context.close).not.toHaveBeenCalled();

    audio.playArrival();
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
  });

  it('schedules a long cinematic rail bed and horn for carriage calls', async () => {
    const { context, oscillators } = fakeAudioContext();
    const audio = createScreenAudioController(() => context);

    await audio.arm();
    audio.playCarriageCall();

    expect(oscillators.length).toBeGreaterThan(10);
    const scheduledStops = oscillators.flatMap((oscillator) => oscillator.stop.mock.calls.map(([when]) => when as number));
    expect(Math.max(...scheduledStops)).toBeGreaterThan(context.currentTime + 10);
  });
});
