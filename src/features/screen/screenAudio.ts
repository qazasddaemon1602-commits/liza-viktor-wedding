import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
import { hasLocalAudioSource, type AudioCueId } from '../../lib/audioManifest';
import { sampleAudio, type SampleAudioController } from '../../lib/sampleAudio';

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
  prepareArrival: () => Promise<boolean>;
  playArrival: () => void;
  stopArrival: () => void;
  playCarriageCall: () => void;
  stopCarriageCall: () => void;
  playQuizVoting: () => void;
  playQuizReveal: () => void;
  playTournamentGong: () => void;
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
  samplePlayer: Pick<SampleAudioController, 'arm' | 'preloadCue' | 'playCue' | 'stopCue'> = sampleAudio,
  hasSample: (id: AudioCueId) => boolean = hasLocalAudioSource,
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
    const needsArrivalFallback = !hasSample('arrival.sequence');
    const needsSequenceFallback = !hasSample('arrival.sequence');
    const needsQuizFallback = !hasSample('ui.confirm') || !hasSample('ui.reveal');
    if (!needsArrivalFallback && !needsSequenceFallback && !needsQuizFallback) {
      const [armed, arrivalBuffer] = await Promise.all([
        samplePlayer.arm(),
        samplePlayer.preloadCue('arrival.sequence'),
      ]);
      return Boolean(armed && arrivalBuffer);
    }
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

  const prepareArrival = async (): Promise<boolean> => {
    if (!hasSample('arrival.sequence')) return true;
    return Boolean(await samplePlayer.preloadCue('arrival.sequence'));
  };

  const rearmFromProjectorControl = () => {
    void arm();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);
  }

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
    if (hasSample('arrival.sequence')) {
      void samplePlayer.playCue('arrival.sequence', { priority: 'scene' });
      return;
    }
    if (!context || context.state !== 'running') return;
    const now = context.currentTime + 0.015;
    playTone(523.25, now, 0.16);
    playTone(659.25, now + 0.19, 0.2);
  };

  const playCarriageCall = () => {
    if (hasSample('arrival.sequence')) {
      void samplePlayer.playCue('arrival.sequence', { priority: 'scene' });
      return;
    }
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

  const playQuizVoting = () => {
    if (hasSample('ui.confirm')) {
      void samplePlayer.playCue('ui.confirm', { priority: 'scene' });
      return;
    }
    if (!context || context.state !== 'running') return;
    const now = context.currentTime + 0.015;
    playTone(392, now, 0.09, 0.012, 'triangle');
    playTone(523.25, now + 0.1, 0.12, 0.014, 'sine');
  };

  const playQuizReveal = () => {
    if (hasSample('ui.reveal')) {
      void samplePlayer.playCue('ui.reveal', { priority: 'scene' });
      return;
    }
    if (!context || context.state !== 'running') return;
    const now = context.currentTime + 0.015;
    playTone(440, now, 0.16, 0.016, 'sine');
    playTone(659.25, now + 0.12, 0.2, 0.018, 'triangle');
  };

  const playTournamentGong = () => {
    if (hasSample('tournament.gong')) {
      void samplePlayer.playCue('tournament.gong', { priority: 'major' });
      return;
    }
    if (!context || context.state !== 'running' || !siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return;
    const now = context.currentTime + 0.015;
    playTone(73.42, now, 1.45, 0.05, 'triangle');
    playTone(110, now + 0.05, 1.1, 0.035, 'sine');
  };

  const stopArrival = () => {
    if (hasSample('arrival.sequence')) samplePlayer.stopCue('arrival.sequence');
    stopOscillators();
  };
  const stopCarriageCall = () => {
    if (hasSample('arrival.sequence')) samplePlayer.stopCue('arrival.sequence');
    stopOscillators();
  };

  const dispose = () => {
    unsubscribeSettings();
    if (typeof window !== 'undefined') {
      window.removeEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);
    }
    stopOscillators();
    if (hasSample('arrival.sequence')) samplePlayer.stopCue('arrival.sequence');
    const current = context;
    context = null;
    masterGain = null;
    if (!usesSharedBrowserContext && current) void current.close().catch(() => undefined);
  };

  return {
    arm,
    prepareArrival,
    playArrival,
    stopArrival,
    playCarriageCall,
    stopCarriageCall,
    playQuizVoting,
    playQuizReveal,
    playTournamentGong,
    dispose,
  };
}

