import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';

type PremiereAudioParamLike = {
  setValueAtTime: (value: number, time: number) => unknown;
  linearRampToValueAtTime: (value: number, time: number) => unknown;
};

type PremiereOscillatorLike = {
  type: OscillatorType;
  frequency: Pick<PremiereAudioParamLike, 'setValueAtTime'>;
  connect: (destination: unknown) => unknown;
  start: (when?: number) => unknown;
  stop: (when?: number) => unknown;
};

type PremiereGainLike = {
  gain: PremiereAudioParamLike;
  connect: (destination: unknown) => unknown;
};

export type PremiereAudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<unknown>;
  close: () => Promise<unknown>;
  createOscillator: () => PremiereOscillatorLike;
  createGain: () => PremiereGainLike;
};

export type PremiereCountdownCue = 'countdown-tick' | 'countdown-final';

export type PremiereAudioController = {
  arm: () => Promise<boolean>;
  playCountdownTick: (second: number) => void;
  dispose: () => void;
};

type PremiereAudioContextFactory = () => PremiereAudioContextLike;

export function getCountdownCue(second: number): PremiereCountdownCue | null {
  if (!Number.isInteger(second) || second < 1 || second > 10) return null;
  return second <= 3 ? 'countdown-final' : 'countdown-tick';
}

function browserAudioContextFactory(): PremiereAudioContextLike {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported');
  return new AudioContextConstructor() as unknown as PremiereAudioContextLike;
}

export function createPremiereAudioController(
  factory: PremiereAudioContextFactory = browserAudioContextFactory,
): PremiereAudioController {
  let context: PremiereAudioContextLike | null = null;

  const getContext = () => {
    context ??= factory();
    return context;
  };

  const arm = async (): Promise<boolean> => {
    if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return false;
    try {
      const current = getContext();
      if (current.state !== 'running') await current.resume();
      return current.state === 'running';
    } catch {
      return false;
    }
  };

  const rearmFromProjectorControl = () => {
    void arm();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);
  }

  const playCountdownTick = (second: number) => {
    const cue = getCountdownCue(second);
    const volume = siteAudio.getVolume();
    if (!cue || !siteAudio.isEnabled() || volume <= 0) return;

    let current: PremiereAudioContextLike;
    try {
      current = getContext();
    } catch {
      return;
    }
    if (current.state !== 'running') return;

    const startAt = current.currentTime + 0.012;
    const final = cue === 'countdown-final';
    const frequency = final ? 146.83 : 110;
    const peak = (final ? 0.028 : 0.018) * volume;
    const duration = final ? 0.16 : 0.12;

    const oscillator = current.createOscillator();
    const gain = current.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + 0.018);
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(current.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.025);
  };

  const dispose = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);
    }
    if (!context) return;
    const current = context;
    context = null;
    void current.close().catch(() => undefined);
  };

  return { arm, playCountdownTick, dispose };
}
