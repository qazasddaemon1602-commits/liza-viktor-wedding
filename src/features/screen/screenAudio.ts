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
  playCarriageCall: () => void;
  stopCarriageCall: () => void;
  dispose: () => void;
};

type AudioContextFactory = () => AudioContextLike;

function browserAudioContextFactory(): AudioContextLike {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported');
  return new AudioContextConstructor() as unknown as AudioContextLike;
}

function createCarriageMedia(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  const audio = new Audio('/audio/train/carriage-call.mp3');
  audio.preload = 'auto';
  audio.volume = 0.72;
  return audio;
}

export function createScreenAudioController(
  factory: AudioContextFactory = browserAudioContextFactory,
): ScreenAudioController {
  let context: AudioContextLike | null = null;
  let carriageMedia: HTMLAudioElement | null = null;
  const activeOscillators = new Set<OscillatorLike>();

  const arm = async (): Promise<boolean> => {
    try {
      context ??= factory();
      carriageMedia ??= createCarriageMedia();
      if (context.state !== 'running') await context.resume();
      return context.state === 'running';
    } catch {
      return false;
    }
  };

  const playTone = (
    frequency: number,
    startAt: number,
    duration: number,
    peak = 0.024,
    type: OscillatorType = 'sine',
  ) => {
    if (!context || context.state !== 'running') return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + Math.min(0.08, duration / 5));
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

  const stopOscillators = () => {
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

  const stopCarriageCall = () => {
    if (carriageMedia) {
      carriageMedia.pause();
      try {
        carriageMedia.currentTime = 0;
      } catch {
        // Some browsers disallow seeking before metadata; pausing is enough.
      }
    }
    stopOscillators();
  };

  const playGeneratedCarriageFallback = () => {
    if (!context || context.state !== 'running') return;
    const start = context.currentTime + 0.02;

    // Low rail/engine bed.
    playTone(48, start, 10.8, 0.045, 'triangle');
    playTone(63, start + 0.15, 10.1, 0.028, 'sine');
    for (let index = 0; index < 10; index += 1) {
      const at = start + 0.55 + index * 0.82;
      playTone(index % 2 === 0 ? 92 : 104, at, 0.12, 0.018, 'triangle');
    }

    // Station chime followed by a cinematic two-note train horn.
    playTone(523.25, start + 0.15, 0.17, 0.018, 'sine');
    playTone(659.25, start + 0.38, 0.2, 0.017, 'sine');
    playTone(174.61, start + 2.7, 1.35, 0.055, 'triangle');
    playTone(130.81, start + 2.82, 1.25, 0.044, 'sine');
    playTone(155.56, start + 4.35, 0.85, 0.035, 'triangle');
  };

  const playCarriageCall = () => {
    stopCarriageCall();
    carriageMedia ??= createCarriageMedia();
    if (!carriageMedia) {
      playGeneratedCarriageFallback();
      return;
    }

    try {
      carriageMedia.currentTime = 0;
      const playback = carriageMedia.play();
      if (playback && typeof playback.catch === 'function') {
        void playback.catch(() => playGeneratedCarriageFallback());
      }
    } catch {
      playGeneratedCarriageFallback();
    }
  };

  const stopArrival = () => {
    stopOscillators();
  };

  const dispose = () => {
    stopCarriageCall();
    const current = context;
    context = null;
    carriageMedia = null;
    if (current) void current.close().catch(() => undefined);
  };

  return {
    arm,
    playArrival,
    stopArrival,
    playCarriageCall,
    stopCarriageCall,
    dispose,
  };
}
