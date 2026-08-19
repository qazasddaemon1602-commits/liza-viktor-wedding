export type SiteAudioCue =
  | 'tap'
  | 'select'
  | 'confirm'
  | 'success'
  | 'error'
  | 'reveal'
  | 'countdown'
  | 'impact';

export type SiteAudioPriority = 'ui' | 'scene' | 'major';

export type SiteAudioSettings = {
  enabled: boolean;
  volume: number;
};

type AudioParamLike = {
  setValueAtTime: (value: number, time: number) => unknown;
  linearRampToValueAtTime: (value: number, time: number) => unknown;
  exponentialRampToValueAtTime?: (value: number, time: number) => unknown;
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

export type SiteAudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<unknown>;
  close: () => Promise<unknown>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainLike;
};

type AudioContextFactory = () => SiteAudioContextLike;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type SiteAudioControllerOptions = {
  factory?: AudioContextFactory;
  storage?: StorageLike | null;
  now?: () => number;
};

const ENABLED_STORAGE_KEY = 'love-story-live:sound-enabled';
const VOLUME_STORAGE_KEY = 'love-story-live:sound-volume';
const DEFAULT_VOLUME = 0.75;
const TAP_RATE_LIMIT_MS = 45;
const priorityWeight: Record<SiteAudioPriority, number> = {
  ui: 0,
  scene: 1,
  major: 2,
};

const cuePriority: Record<SiteAudioCue, SiteAudioPriority> = {
  tap: 'ui',
  select: 'ui',
  confirm: 'ui',
  success: 'scene',
  error: 'scene',
  reveal: 'scene',
  countdown: 'scene',
  impact: 'scene',
};

function browserAudioContextFactory(): SiteAudioContextLike {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Web Audio is not supported');
  return new AudioContextConstructor() as unknown as SiteAudioContextLike;
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storedEnabled(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(ENABLED_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

function storedVolume(storage: StorageLike | null): number {
  try {
    const stored = storage?.getItem(VOLUME_STORAGE_KEY);
    if (stored == null || stored === '') return DEFAULT_VOLUME;
    return clampVolume(Number(stored));
  } catch {
    return DEFAULT_VOLUME;
  }
}

function cueShape(cue: SiteAudioCue) {
  switch (cue) {
    case 'tap': return { frequency: 360, frequency2: 0, duration: 0.035, peak: 0.011, type: 'sine' as OscillatorType };
    case 'select': return { frequency: 430, frequency2: 620, duration: 0.07, peak: 0.014, type: 'sine' as OscillatorType };
    case 'confirm': return { frequency: 330, frequency2: 494, duration: 0.09, peak: 0.018, type: 'triangle' as OscillatorType };
    case 'success': return { frequency: 392, frequency2: 659, duration: 0.18, peak: 0.025, type: 'sine' as OscillatorType };
    case 'error': return { frequency: 128, frequency2: 92, duration: 0.17, peak: 0.026, type: 'triangle' as OscillatorType };
    case 'reveal': return { frequency: 220, frequency2: 440, duration: 0.16, peak: 0.018, type: 'sine' as OscillatorType };
    case 'countdown': return { frequency: 116, frequency2: 0, duration: 0.11, peak: 0.018, type: 'sine' as OscillatorType };
    case 'impact': return { frequency: 78, frequency2: 46, duration: 0.28, peak: 0.034, type: 'triangle' as OscillatorType };
  }
}

export type SiteAudioController = {
  arm: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getSettings: () => SiteAudioSettings;
  subscribe: (callback: (settings: SiteAudioSettings) => void) => () => void;
  isArmed: () => boolean;
  play: (cue: SiteAudioCue) => boolean;
  beginPriority: (priority: SiteAudioPriority) => void;
  endPriority: (priority: SiteAudioPriority) => void;
  stopAll: () => void;
  dispose: () => void;
};

export function createSiteAudioController(options: SiteAudioControllerOptions = {}): SiteAudioController {
  const factory = options.factory ?? browserAudioContextFactory;
  const storage = options.storage === undefined
    ? (typeof window === 'undefined' ? null : browserStorage())
    : options.storage;
  const now = options.now ?? (() => Date.now());

  let enabled = storedEnabled(storage);
  let volume = storedVolume(storage);
  let context: SiteAudioContextLike | null = null;
  let armed = false;
  let lastUiCueAt = -Infinity;
  const activeOscillators = new Set<OscillatorLike>();
  const priorityCounts: Record<SiteAudioPriority, number> = { ui: 0, scene: 0, major: 0 };
  const listeners = new Set<(settings: SiteAudioSettings) => void>();

  const getSettings = (): SiteAudioSettings => ({ enabled, volume });
  const notify = () => {
    const settings = getSettings();
    for (const listener of listeners) listener(settings);
  };

  const activePriorityWeight = () => {
    if (priorityCounts.major > 0) return priorityWeight.major;
    if (priorityCounts.scene > 0) return priorityWeight.scene;
    return priorityWeight.ui;
  };

  const arm = async (): Promise<boolean> => {
    if (!enabled || volume <= 0) return false;
    try {
      context ??= factory();
      if (context.state !== 'running') await context.resume();
      armed = context.state === 'running';
      return armed;
    } catch {
      armed = false;
      return false;
    }
  };

  const stopAll = () => {
    if (!context) return;
    for (const oscillator of activeOscillators) {
      try {
        oscillator.stop(context.currentTime);
      } catch {
        // Already stopped.
      }
    }
    activeOscillators.clear();
  };

  const setEnabled = (next: boolean) => {
    enabled = Boolean(next);
    try {
      storage?.setItem(ENABLED_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Storage is advisory only.
    }
    if (!enabled) stopAll();
    notify();
  };

  const setVolume = (next: number) => {
    volume = clampVolume(next);
    try {
      storage?.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      // Storage is advisory only.
    }
    if (volume <= 0) stopAll();
    notify();
  };

  const playTone = (frequency: number, startAt: number, duration: number, peak: number, type: OscillatorType) => {
    if (!context || context.state !== 'running' || !enabled || volume <= 0) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak * volume, startAt + Math.min(0.02, duration / 4));
    gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => activeOscillators.delete(oscillator);
    activeOscillators.add(oscillator);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  };

  const play = (cue: SiteAudioCue): boolean => {
    if (!enabled || volume <= 0 || !armed || !context || context.state !== 'running') return false;
    if (activePriorityWeight() > priorityWeight[cuePriority[cue]]) return false;

    if (cuePriority[cue] === 'ui') {
      const current = now();
      if (current - lastUiCueAt < TAP_RATE_LIMIT_MS) return false;
      lastUiCueAt = current;
    }

    const shape = cueShape(cue);
    const startAt = context.currentTime + 0.008;
    playTone(shape.frequency, startAt, shape.duration, shape.peak, shape.type);
    if (shape.frequency2 > 0) {
      playTone(shape.frequency2, startAt + Math.max(0.028, shape.duration * 0.38), shape.duration * 0.82, shape.peak * 0.82, shape.type);
    }
    return true;
  };

  const beginPriority = (priority: SiteAudioPriority) => {
    priorityCounts[priority] += 1;
  };

  const endPriority = (priority: SiteAudioPriority) => {
    priorityCounts[priority] = Math.max(0, priorityCounts[priority] - 1);
  };

  const subscribe = (callback: (settings: SiteAudioSettings) => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };

  const dispose = () => {
    stopAll();
    listeners.clear();
    const current = context;
    context = null;
    armed = false;
    if (current) void current.close().catch(() => undefined);
  };

  return {
    arm,
    setEnabled,
    isEnabled: () => enabled,
    setVolume,
    getVolume: () => volume,
    getSettings,
    subscribe,
    isArmed: () => armed,
    play,
    beginPriority,
    endPriority,
    stopAll,
    dispose,
  };
}

export const siteAudio = createSiteAudioController();

function cueFromElement(element: Element): SiteAudioCue {
  const explicit = element.getAttribute('data-audio-cue') as SiteAudioCue | null;
  if (explicit && explicit in cuePriority) return explicit;
  if (element.matches('input[type="radio"], input[type="checkbox"], [role="option"], [aria-pressed]')) return 'select';
  if (element.matches('button[type="submit"], input[type="submit"]')) return 'confirm';
  return 'tap';
}

export function installGlobalInteractionAudio(controller: SiteAudioController = siteAudio): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const interactiveSelector = [
    'button',
    'a[href]',
    '[role="button"]',
    '[role="option"]',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="radio"]',
    'input[type="checkbox"]',
    '[data-audio-cue]',
  ].join(',');

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target.closest(interactiveSelector) : null;
    if (!target || target.hasAttribute('data-audio-disabled')) return;
    if (target.matches(':disabled, [aria-disabled="true"]')) return;

    const cue = cueFromElement(target);
    void controller.arm().then((ready) => {
      if (ready) controller.play(cue);
    });
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  return () => document.removeEventListener('pointerdown', onPointerDown, true);
}