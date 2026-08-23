import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
import { hasLocalAudioSource, type AudioCueId } from '../../lib/audioManifest';
import { sampleAudio, type SampleAudioController } from '../../lib/sampleAudio';

export type ProjectorSoundtrackTheme = 'celebration' | 'game' | 'tournament' | 'heist' | 'finale';

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
  setSoundtrackTheme: (theme: ProjectorSoundtrackTheme) => void;
  stopSoundtrack: () => void;
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

type SoundtrackPattern = {
  bpm: number;
  rootHz: number;
  bass: readonly number[];
  sparkle: readonly number[];
  gain: number;
};

const SOUNDTRACK_PATTERNS: Record<ProjectorSoundtrackTheme, SoundtrackPattern> = {
  celebration: {
    bpm: 116,
    rootHz: 130.81,
    bass: [0, 0, 9, 9, 5, 5, 7, 7, 0, 0, 9, 9, 5, 7, 9, 7],
    sparkle: [12, 16, 19, 16, 21, 19, 16, 19, 12, 16, 21, 19, 17, 19, 21, 23],
    gain: 0.32,
  },
  game: {
    bpm: 122,
    rootHz: 146.83,
    bass: [0, 0, 7, 7, 10, 10, 5, 5, 0, 3, 7, 10, 5, 7, 10, 7],
    sparkle: [12, 15, 19, 22, 19, 15, 17, 19, 12, 15, 17, 22, 20, 19, 17, 15],
    gain: 0.3,
  },
  tournament: {
    bpm: 128,
    rootHz: 110,
    bass: [0, 0, 3, 3, 7, 7, 10, 10, 0, 0, 10, 10, 7, 7, 3, 5],
    sparkle: [12, 15, 19, 22, 24, 22, 19, 15, 12, 19, 22, 24, 22, 19, 17, 15],
    gain: 0.34,
  },
  heist: {
    bpm: 112,
    rootHz: 123.47,
    bass: [0, 0, 3, 3, 7, 7, 5, 5, 0, 10, 7, 3, 5, 7, 10, 7],
    sparkle: [12, 15, 19, 18, 15, 19, 22, 19, 12, 15, 18, 19, 22, 19, 18, 15],
    gain: 0.27,
  },
  finale: {
    bpm: 120,
    rootHz: 130.81,
    bass: [0, 0, 5, 5, 7, 7, 9, 9, 0, 4, 5, 7, 9, 7, 5, 7],
    sparkle: [12, 16, 19, 24, 21, 19, 16, 19, 24, 23, 21, 19, 17, 19, 21, 24],
    gain: 0.36,
  },
};

const SOUNDTRACK_FADE_OUT_MS = 700;
const SOUNDTRACK_FADE_IN_SECONDS = 0.9;
const SOUNDTRACK_STOP_FADE_MS = 800;

function transpose(rootHz: number, semitones: number) {
  return rootHz * Math.pow(2, semitones / 12);
}

export function createScreenAudioController(
  factory: AudioContextFactory = browserAudioContextFactory,
  samplePlayer: Pick<SampleAudioController, 'arm' | 'preloadCue' | 'playCue' | 'stopCue'> = sampleAudio,
  hasSample: (id: AudioCueId) => boolean = hasLocalAudioSource,
): ScreenAudioController {
  let context: AudioContextLike | null = null;
  let masterGain: GainLike | null = null;
  let soundtrackGain: GainLike | null = null;
  let soundtrackTheme: ProjectorSoundtrackTheme | null = null;
  let soundtrackInterval: number | null = null;
  let soundtrackTransitionTimer: number | null = null;
  let soundtrackStep = 0;
  let soundtrackNextAt = 0;
  let soundtrackRevision = 0;
  const usesSharedBrowserContext = factory === browserAudioContextFactory;
  const activeOscillators = new Set<OscillatorLike>();
  const soundtrackOscillators = new Set<OscillatorLike>();

  const applyMasterVolume = () => {
    if (!context || !masterGain) return;
    const audible = siteAudio.isEnabled() && siteAudio.getVolume() > 0;
    masterGain.gain.setValueAtTime(audible ? siteAudio.getVolume() : 0, context.currentTime);
  };

  const ensureMasterGraph = () => {
    context ??= factory();
    if (!masterGain) {
      masterGain = context.createGain();
      masterGain.connect(context.destination);
    }
    applyMasterVolume();
    return context;
  };

  const ensureSoundtrackGraph = () => {
    const current = ensureMasterGraph();
    if (!soundtrackGain) {
      soundtrackGain = current.createGain();
      soundtrackGain.gain.setValueAtTime(0.0001, current.currentTime);
      soundtrackGain.connect(masterGain as GainLike);
    }
    return current;
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

  const stopSoundtrackOscillators = () => {
    if (!context) return;
    for (const oscillator of soundtrackOscillators) {
      try {
        oscillator.stop(context.currentTime);
      } catch {
        // Already ended.
      }
    }
    soundtrackOscillators.clear();
  };

  const clearSoundtrackScheduler = () => {
    if (soundtrackInterval !== null) window.clearInterval(soundtrackInterval);
    soundtrackInterval = null;
  };

  const clearSoundtrackTransition = () => {
    if (soundtrackTransitionTimer !== null) window.clearTimeout(soundtrackTransitionTimer);
    soundtrackTransitionTimer = null;
  };

  const silenceSoundtrackImmediately = () => {
    clearSoundtrackScheduler();
    clearSoundtrackTransition();
    stopSoundtrackOscillators();
    if (context && soundtrackGain) {
      soundtrackGain.gain.setValueAtTime(0.0001, context.currentTime);
    }
  };

  const unsubscribeSettings = siteAudio.subscribe(() => applyMasterVolume());

  const arm = async (): Promise<boolean> => {
    if (!siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return false;
    const needsArrivalFallback = !hasSample('arrival.sequence');
    const needsSequenceFallback = !hasSample('arrival.sequence');
    const needsQuizFallback = !hasSample('ui.confirm') || !hasSample('ui.reveal');
    const needsSoundtrackContext = soundtrackTheme !== null;
    if (!needsArrivalFallback && !needsSequenceFallback && !needsQuizFallback && !needsSoundtrackContext) {
      const [armed, arrivalBuffer] = await Promise.all([
        samplePlayer.arm(),
        samplePlayer.preloadCue('arrival.sequence'),
      ]);
      return Boolean(armed && arrivalBuffer);
    }
    try {
      const current = needsSoundtrackContext ? ensureSoundtrackGraph() : ensureMasterGraph();
      if (current.state !== 'running') await current.resume();
      applyMasterVolume();
      return current.state === 'running';
    } catch {
      return false;
    }
  };

  const prepareArrival = async (): Promise<boolean> => {
    if (!hasSample('arrival.sequence')) return true;
    return Boolean(await samplePlayer.preloadCue('arrival.sequence'));
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

  const playSoundtrackTone = (
    frequency: number,
    startAt: number,
    duration: number,
    peak: number,
    type: OscillatorType,
  ) => {
    if (!context || context.state !== 'running' || !soundtrackGain || !siteAudio.isEnabled() || siteAudio.getVolume() <= 0) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + Math.min(0.025, duration / 4));
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(soundtrackGain);
    oscillator.onended = () => soundtrackOscillators.delete(oscillator);
    soundtrackOscillators.add(oscillator);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  };

  const scheduleSoundtrackStep = (theme: ProjectorSoundtrackTheme, step: number, at: number) => {
    const pattern = SOUNDTRACK_PATTERNS[theme];
    const bassSemitone = pattern.bass[step % pattern.bass.length] ?? 0;
    const sparkleSemitone = pattern.sparkle[step % pattern.sparkle.length] ?? 12;

    if (step % 4 === 0) {
      playSoundtrackTone(58, at, 0.12, 0.17, 'sine');
      playSoundtrackTone(116, at + 0.01, 0.055, 0.035, 'triangle');
    }
    if (step % 2 === 1) {
      playSoundtrackTone(1760, at, 0.035, 0.018, 'square');
    }

    playSoundtrackTone(transpose(pattern.rootHz, bassSemitone), at, 0.2, 0.075, 'triangle');
    if (step % 2 === 0) {
      playSoundtrackTone(transpose(pattern.rootHz, sparkleSemitone), at + 0.025, 0.12, 0.032, 'sine');
    } else {
      playSoundtrackTone(transpose(pattern.rootHz, sparkleSemitone + 7), at + 0.025, 0.09, 0.024, 'triangle');
    }
  };

  const beginSoundtrack = (theme: ProjectorSoundtrackTheme, revision: number) => {
    if (!context || context.state !== 'running' || soundtrackTheme !== theme || revision !== soundtrackRevision) return;
    const pattern = SOUNDTRACK_PATTERNS[theme];
    const stepSeconds = 60 / pattern.bpm / 4;
    ensureSoundtrackGraph();
    soundtrackGain?.gain.setValueAtTime(0.0001, context.currentTime);
    soundtrackGain?.gain.linearRampToValueAtTime(
      pattern.gain,
      context.currentTime + SOUNDTRACK_FADE_IN_SECONDS,
    );
    soundtrackStep = 0;
    soundtrackNextAt = context.currentTime + 0.06;

    const scheduleAhead = () => {
      if (!context || context.state !== 'running' || soundtrackTheme !== theme || revision !== soundtrackRevision) return;
      const horizon = context.currentTime + 0.65;
      while (soundtrackNextAt < horizon) {
        scheduleSoundtrackStep(theme, soundtrackStep, soundtrackNextAt);
        soundtrackStep = (soundtrackStep + 1) % 16;
        soundtrackNextAt += stepSeconds;
      }
    };

    scheduleAhead();
    soundtrackInterval = window.setInterval(scheduleAhead, 180);
  };

  const setSoundtrackTheme = (theme: ProjectorSoundtrackTheme) => {
    if (soundtrackTheme === theme && (soundtrackInterval !== null || soundtrackTransitionTimer !== null)) return;

    const hadTheme = soundtrackTheme !== null;
    soundtrackTheme = theme;
    soundtrackRevision += 1;
    const revision = soundtrackRevision;

    if (theme === 'heist' || theme === 'finale') {
      samplePlayer.stopCue('bunker.ambience');
    }

    clearSoundtrackScheduler();
    clearSoundtrackTransition();

    const canFade = Boolean(
      hadTheme
      && context
      && soundtrackGain
      && context.state === 'running',
    );
    const delayMs = canFade ? SOUNDTRACK_FADE_OUT_MS : 0;
    if (canFade && context && soundtrackGain) {
      soundtrackGain.gain.linearRampToValueAtTime(
        0.0001,
        context.currentTime + SOUNDTRACK_FADE_OUT_MS / 1000,
      );
    }

    soundtrackTransitionTimer = window.setTimeout(() => {
      soundtrackTransitionTimer = null;
      if (soundtrackTheme !== theme || revision !== soundtrackRevision) return;
      stopSoundtrackOscillators();
      void arm().then((ready) => {
        if (ready && soundtrackTheme === theme && revision === soundtrackRevision) {
          beginSoundtrack(theme, revision);
        }
      });
    }, delayMs);
  };

  const stopSoundtrack = () => {
    if (soundtrackTheme === null && soundtrackInterval === null && soundtrackTransitionTimer === null) return;
    soundtrackTheme = null;
    soundtrackRevision += 1;
    clearSoundtrackScheduler();
    clearSoundtrackTransition();

    if (context && soundtrackGain && context.state === 'running') {
      soundtrackGain.gain.linearRampToValueAtTime(
        0.0001,
        context.currentTime + SOUNDTRACK_STOP_FADE_MS / 1000,
      );
      soundtrackTransitionTimer = window.setTimeout(() => {
        soundtrackTransitionTimer = null;
        stopSoundtrackOscillators();
        if (context && soundtrackGain) {
          soundtrackGain.gain.setValueAtTime(0.0001, context.currentTime);
        }
      }, SOUNDTRACK_STOP_FADE_MS + 40);
      return;
    }

    silenceSoundtrackImmediately();
  };

  const rearmFromProjectorControl = () => {
    const theme = soundtrackTheme;
    const revision = soundtrackRevision;
    void arm().then((ready) => {
      if (
        ready
        && theme
        && soundtrackTheme === theme
        && revision === soundtrackRevision
        && soundtrackInterval === null
        && soundtrackTransitionTimer === null
      ) {
        beginSoundtrack(theme, revision);
      }
    });
  };
  if (typeof window !== 'undefined') {
    window.addEventListener(PROJECTOR_AUDIO_REARM_EVENT, rearmFromProjectorControl);
  }

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

    playTone(48, start, 10.8, 0.045, 'triangle');
    playTone(63, start + 0.15, 10.1, 0.028, 'sine');

    for (let index = 0; index < 11; index += 1) {
      const at = start + 0.55 + index * 0.78;
      playTone(index % 2 === 0 ? 92 : 104, at, 0.12, 0.018, 'triangle');
    }

    playTone(523.25, start + 0.15, 0.17, 0.018, 'sine');
    playTone(659.25, start + 0.38, 0.2, 0.017, 'sine');
    playTone(174.61, start + 2.7, 1.35, 0.055, 'triangle');
    playTone(130.81, start + 2.82, 1.25, 0.044, 'sine');
    playTone(155.56, start + 4.35, 0.85, 0.035, 'triangle');
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
    soundtrackTheme = null;
    soundtrackRevision += 1;
    silenceSoundtrackImmediately();
    stopOscillators();
    if (hasSample('arrival.sequence')) samplePlayer.stopCue('arrival.sequence');
    const current = context;
    context = null;
    masterGain = null;
    soundtrackGain = null;
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
    setSoundtrackTheme,
    stopSoundtrack,
    dispose,
  };
}
