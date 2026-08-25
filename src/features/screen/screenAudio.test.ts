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

describe('createScreenAudioController', () => {
  beforeEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
  });

  afterEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
  });

  it('stays silent until the projector has been armed by a local interaction', () => {
    const { context } = fakeAudioContext();
    const factory = vi.fn(() => context);
    const audio = createScreenAudioController(factory, undefined, () => false);

    audio.playArrival();

    expect(factory).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();
    audio.dispose();
  });

  it('arms once and plays a quiet two-note arrival signal through a master gain', async () => {
    const { context, oscillators, gains } = fakeAudioContext();
    const factory = vi.fn(() => context);
    const audio = createScreenAudioController(factory, undefined, () => false);

    expect(await audio.arm()).toBe(true);
    expect(context.resume).toHaveBeenCalledTimes(1);

    audio.playArrival();

    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    expect(context.createGain).toHaveBeenCalledTimes(3);
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0.75, context.currentTime);
    expect(oscillators[0].start).toHaveBeenCalled();
    expect(oscillators[1].start).toHaveBeenCalled();
    expect(gains[1].gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(gains[2].gain.linearRampToValueAtTime).toHaveBeenCalled();
    audio.dispose();
  });

  it('updates the live master gain when volume or mute changes', async () => {
    const { context, gains } = fakeAudioContext();
    const audio = createScreenAudioController(() => context, undefined, () => false);

    await audio.arm();
    const master = gains[0];

    siteAudio.setVolume(0.25);
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(0.25, context.currentTime);

    siteAudio.setEnabled(false);
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(0, context.currentTime);
    audio.dispose();
  });

  it('stops already scheduled arrival notes immediately without closing the armed audio context', async () => {
    const { context, oscillators } = fakeAudioContext();
    const audio = createScreenAudioController(() => context, undefined, () => false);

    await audio.arm();
    audio.playArrival();
    audio.stopArrival();

    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].stop).toHaveBeenLastCalledWith(context.currentTime);
    expect(oscillators[1].stop).toHaveBeenLastCalledWith(context.currentTime);
    expect(context.close).not.toHaveBeenCalled();

    audio.playArrival();
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
    audio.dispose();
  });

  it('schedules a long cinematic rail bed and horn for carriage calls', async () => {
    const { context, oscillators } = fakeAudioContext();
    const audio = createScreenAudioController(() => context, undefined, () => false);

    await audio.arm();
    audio.playCarriageCall();

    expect(oscillators.length).toBeGreaterThan(10);
    const scheduledStops = oscillators.flatMap((oscillator) => oscillator.stop.mock.calls.map(([when]) => when as number));
    expect(Math.max(...scheduledStops)).toBeGreaterThan(context.currentTime + 10);
    audio.dispose();
  });

  it('routes acquired local cues through the shared sample bus without oscillator duplication', async () => {
    const { context } = fakeAudioContext();
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      preloadCue: vi.fn().mockResolvedValue({ duration: 14 }),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createScreenAudioController(
      () => context,
      samplePlayer,
      () => true,
    );

    await expect(audio.arm()).resolves.toBe(true);
    audio.playArrival();
    audio.playCarriageCall();
    audio.playQuizVoting();
    audio.startQuizMusic();
    audio.playQuizCountdown();
    audio.playQuizReveal();
    audio.stopQuizMusic();
    audio.playTournamentGong();
    audio.stopArrival();
    audio.stopCarriageCall();

    expect(samplePlayer.playCue).toHaveBeenNthCalledWith(1, 'arrival.sequence', { priority: 'scene' });
    expect(samplePlayer.playCue).toHaveBeenNthCalledWith(2, 'arrival.sequence', { priority: 'scene' });
    expect(samplePlayer.playCue).toHaveBeenCalledWith('ui.confirm', { priority: 'scene' });
    expect(samplePlayer.playCue).toHaveBeenCalledWith('quiz.ambience', { loop: true, priority: 'ui' });
    expect(samplePlayer.playCue).toHaveBeenCalledWith('ui.countdown', { priority: 'scene' });
    expect(samplePlayer.playCue).toHaveBeenCalledWith('ui.reveal', { priority: 'scene' });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('quiz.ambience');
    expect(samplePlayer.playCue).toHaveBeenCalledWith('tournament.gong', { priority: 'major' });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('arrival.sequence');
    expect(context.createOscillator).not.toHaveBeenCalled();
    audio.dispose();
    expect(samplePlayer.stopCue).not.toHaveBeenCalledWith(`arrival.${'chime'}`);
  });

  it('decodes the arrival recording during preparation without starting or arming playback', async () => {
    const { context } = fakeAudioContext();
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      preloadCue: vi.fn().mockResolvedValue({ duration: 14 }),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createScreenAudioController(
      () => context,
      samplePlayer,
      () => true,
    );

    await expect(audio.prepareArrival()).resolves.toBe(true);

    expect(samplePlayer.preloadCue).toHaveBeenCalledWith('arrival.sequence');
    expect(samplePlayer.arm).not.toHaveBeenCalled();
    expect(samplePlayer.playCue).not.toHaveBeenCalled();
    audio.dispose();
  });
});

