type AudioParamLike = {
  setValueAtTime: (value: number, time: number) => unknown;
  linearRampToValueAtTime: (value: number, time: number) => unknown;
};

type OscillatorLike = {
  type: OscillatorType;
  frequency: Pick<AudioParamLike, 'setValueAtTime'>;
  connect: (destination: unknown) => unknown;
  start: (when?: number) => unknown;
  stop: (when?: number) => unknown;
  onended?: (() => void) | null;
};

type GainLike = {
  gain: AudioParamLike;
  connect: (destination: unknown) => unknown;
};

type AudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<unknown>;
  close: () => Promise<unknown>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainLike;
};

export type ScreenAudioController = {
  arm: () => Promise<boolean>;
  playArrival: () => void;
  stopArrival: () => void;
  dispose: () => void;
};

type AudioContextFactory = () => AudioContextLike;

function browserAudioContextFactory(): AudioContextLike {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported');
  return new AudioContextConstructor() as unknown as AudioContextLike;
}

export function createScreenAudioController(
  factory: AudioContextFactory = browserAudioContextFactory,
): ScreenAudioController {
  let context: AudioContextLike | null = null;
  const activeOscillators = new Set<OscillatorLike>();

  const arm = async (): Promise<boolean> => {
    try {
      context ??= factory();
      if (context.state !== 'running') await context.resume();
      return context.state === 'running';
    } catch {
      return false;
    }
  };

  const playTone = (frequency: number, startAt: number, duration: number) => {
    if (!context || context.state !== 'running') return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(0.024, startAt + 0.025);
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => activeOscillators.delete(oscillator);
    activeOscillators.add(oscillator);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  };

  const playArrival = () => {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime + 0.015;
    playTone(523.25, now, 0.16);
    playTone(659.25, now + 0.19, 0.2);
  };

  const stopArrival = () => {
    if (!context) return;
    for (const oscillator of activeOscillators) {
      try {
        oscillator.stop(context.currentTime);
      } catch {
        // A naturally-ended oscillator is already silent; continue stopping the rest.
      }
    }
    activeOscillators.clear();
  };

  const dispose = () => {
    if (!context) return;
    stopArrival();
    const current = context;
    context = null;
    void current.close().catch(() => undefined);
  };

  return { arm, playArrival, stopArrival, dispose };
}
