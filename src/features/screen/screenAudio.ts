import { siteAudio } from '../../lib/siteAudio';

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
let sharedBrowserContext: AudioContextLike | null = null;

function browserAudioContextFactory(): AudioContextLike {
  if (sharedBrowserContext && sharedBrowserContext.state !== 'closed') return sharedBrowserContext;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported');
  sharedBrowserContext = new AudioContextConstructor() as unknown as AudioContextLike;
  return sharedBrowserContext;
}

export function createScreenAudioController(
  factory: AudioContextFactory = browserAudioContextFactory,
): ScreenAudioController {
  let context: AudioContextLike | null = null;
  let masterGain: GainLike | null = null;
  const usesSharedBrowserContext = factory === browserAudioContextFactory;
  const activeOscillators = new Set<OscillatorLike>();

  const applyMasterVolume = () => {
    if (!context || !masterGain) return;
    const audible = siteAudio.isEnabled() && siteAudio.getVolume() > 0;
    masterGain.gain.setValueAtTime(audible ? siteAudio.getVolume() : 0, context.currentTime);
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

  const unsubscribeSettings = siteAudio.subscribe(() => applyMasterVolume());

  const arm = async (): Promise<boolean> => {
    if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return false;
    try {
      context ??= factory();
      if (context.state !== 'running') await context.resume();
      if (!masterGain) {
        masterGain = context.createGain();
        masterGain.connect(context.destination);
      }
      applyMasterVolume();
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
    if (!context || context.state !== 'running' || !masterGain || !siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + Math.min(0.08, duration / 5));
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(masterGain);
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

  const playCarriageCall = () => {
    if (!context || context.state !== 'running') return;
    stopOscillators();
    const start = context.currentTime + 0.02;

    // Long low rail/engine bed.
    playTone(48, start, 10.8, 0.045, 'triangle');
    playTone(63, start + 0.15, 10.1, 0.028, 'sine');

    // Rhythmic rail impacts.
    for (let index = 0; index < 11; index += 1) {
      const at = start + 0.55 + index * 0.78;
      playTone(index % 2 === 0 ? 92 : 104, at, 0.12, 0.018, 'triangle');
    }

    // Station chime.
    playTone(523.25, start + 0.15, 0.17, 0.018, 'sine');
    playTone(659.25, start + 0.38, 0.2, 0.017, 'sine');

    // Cinematic two-note train horn.
    playTone(174.61, start + 2.7, 1.35, 0.055, 'triangle');
    playTone(130.81, start + 2.82, 1.25, 0.044, 'sine');
    playTone(155.56, start + 4.35, 0.85, 0.035, 'triangle');

    // Distant tail as the train leaves.
    playTone(92.5, start + 8.45, 1.2, 0.016, 'sine');
    playTone(73.42, start + 9.15, 1.55, 0.012, 'triangle');
  };

  const stopArrival = () => stopOscillators();
  const stopCarriageCall = () => stopOscillators();

  const dispose = () => {
    unsubscribeSettings();
    stopOscillators();
    const current = context;
    context = null;
    masterGain = null;
    if (!usesSharedBrowserContext && current) void current.close().catch(() => undefined);
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
