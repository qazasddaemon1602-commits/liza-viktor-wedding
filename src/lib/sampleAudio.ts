import {
  AUDIO_MANIFEST,
  type AudioCueDefinition,
  type AudioCueId,
  type AudioPriority,
} from './audioManifest';

export type { AudioCueDefinition, AudioCueId, AudioPriority } from './audioManifest';

type AudioParamLike = {
  setValueAtTime: (value: number, time: number) => unknown;
  linearRampToValueAtTime?: (value: number, time: number) => unknown;
};

type GainNodeLike = {
  gain: AudioParamLike;
  connect: (destination: unknown) => unknown;
};

type AudioBufferLike = { duration: number };

type BufferSourceLike = {
  buffer: AudioBufferLike | null;
  loop: boolean;
  connect: (destination: unknown) => unknown;
  start: (when?: number, offset?: number) => unknown;
  stop: (when?: number) => unknown;
  onended?: (() => void) | null;
};

type OscillatorLike = {
  type: OscillatorType;
  frequency: Pick<AudioParamLike, 'setValueAtTime'>;
  connect: (destination: unknown) => unknown;
  start: (when?: number) => unknown;
  stop: (when?: number) => unknown;
  onended?: (() => void) | null;
};

export type SampleAudioContextLike = {
  currentTime: number;
  state: string;
  destination: unknown;
  resume: () => Promise<unknown>;
  close: () => Promise<unknown>;
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBufferLike>;
  createBufferSource: () => BufferSourceLike;
  createGain: () => GainNodeLike;
  createOscillator: () => OscillatorLike;
};

type FetchResponseLike = {
  ok: boolean;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type FetchLike = (input: string) => Promise<FetchResponseLike>;

export type PlayCueOptions = {
  startedAt?: number | string | Date;
  offsetSeconds?: number;
  loop?: boolean;
  priority?: AudioPriority;
};

export type SamplePlaybackResult = 'played' | 'expired' | 'muted' | 'fallback' | 'failed' | 'cancelled';

type StoppableSourceLike = {
  stop: (when?: number) => unknown;
  onended?: (() => void) | null;
};

type ActivePlayback = {
  id: string;
  priority: AudioPriority;
  baseGain: number;
  gain: GainNodeLike;
  source: StoppableSourceLike;
  loop: boolean;
  requestRevision: number;
  lifecycleRevision: number;
};

export type SampleAudioController = {
  arm: () => Promise<boolean>;
  preloadCue: (id: string) => Promise<AudioBufferLike | null>;
  playCue: (id: string, options?: PlayCueOptions) => Promise<SamplePlaybackResult>;
  stopCue: (id: string) => void;
  setMasterVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  dispose: () => void;
};

type CreateSampleAudioOptions = {
  contextFactory?: () => SampleAudioContextLike;
  fetcher?: FetchLike;
  manifest?: Readonly<Record<string, AudioCueDefinition>>;
  now?: () => number;
};

const priorityWeight: Record<AudioPriority, number> = { ui: 0, scene: 1, major: 2 };
const DUCK_FACTOR = 0.25;

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function browserContextFactory(): SampleAudioContextLike {
  const Context = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) throw new Error('Web Audio is not supported');
  return new Context() as unknown as SampleAudioContextLike;
}

function browserFetch(input: string): Promise<FetchResponseLike> {
  return fetch(input);
}

function timestampMs(value: number | string | Date | undefined): number | null {
  if (value === undefined) return null;
  const parsed = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createSampleAudioController(options: CreateSampleAudioOptions = {}): SampleAudioController {
  const contextFactory = options.contextFactory ?? browserContextFactory;
  const fetcher = options.fetcher ?? browserFetch;
  const manifest: Readonly<Record<string, AudioCueDefinition>> = options.manifest ?? AUDIO_MANIFEST;
  const now = options.now ?? (() => Date.now());

  let context: SampleAudioContextLike | null = null;
  let masterGain: GainNodeLike | null = null;
  let masterVolume = 1;
  let muted = false;
  let disposed = false;
  let lifecycleRevision = 0;
  const decoded = new Map<string, Promise<AudioBufferLike | null>>();
  const active = new Set<ActivePlayback>();
  const cueRevisions = new Map<string, number>();

  const cueRevision = (id: string) => cueRevisions.get(id) ?? 0;
  const invalidateCue = (id: string) => cueRevisions.set(id, cueRevision(id) + 1);
  const requestIsCurrent = (id: string, revision: number, lifecycle: number) => (
    !disposed && cueRevision(id) === revision && lifecycleRevision === lifecycle
  );

  const applyMasterVolume = () => {
    if (!context || !masterGain) return;
    masterGain.gain.setValueAtTime(muted ? 0 : masterVolume, context.currentTime);
  };

  const ensureContext = (): SampleAudioContextLike => {
    if (context) return context;
    context = contextFactory();
    masterGain = context.createGain();
    masterGain.connect(context.destination);
    applyMasterVolume();
    return context;
  };

  const arm = async (): Promise<boolean> => {
    if (muted || masterVolume <= 0) return false;
    try {
      const current = ensureContext();
      if (current.state !== 'running') await current.resume();
      return current.state === 'running';
    } catch {
      return false;
    }
  };

  const preloadCue = async (id: string): Promise<AudioBufferLike | null> => {
    if (disposed) return null;
    const cue = manifest[id];
    if (!cue?.src) return null;
    const cached = decoded.get(id);
    if (cached) return cached;

    const loading = (async () => {
      try {
        const current = ensureContext();
        const response = await fetcher(cue.src as string);
        if (!response.ok) return null;
        return await current.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    })();
    decoded.set(id, loading);
    const result = await loading;
    if (result === null && decoded.get(id) === loading) decoded.delete(id);
    return result;
  };

  const applyDucking = () => {
    if (!context) return;
    let highest = -1;
    for (const playback of active) highest = Math.max(highest, priorityWeight[playback.priority]);
    for (const playback of active) {
      const isDucked = priorityWeight[playback.priority] < highest;
      playback.gain.gain.setValueAtTime(
        playback.baseGain * (isDucked ? DUCK_FACTOR : 1),
        context.currentTime,
      );
    }
  };

  const stopActiveCue = (id: string) => {
    if (!context) return;
    for (const playback of [...active]) {
      if (playback.id !== id) continue;
      active.delete(playback);
      try {
        playback.source.stop(context.currentTime);
      } catch {
        // An already-ended source is silent.
      }
    }
    applyDucking();
  };

  const playFallback = (
    id: string,
    cue: AudioCueDefinition,
    loop: boolean,
    priority: AudioPriority,
    requestRevision: number,
    requestLifecycle: number,
  ): SamplePlaybackResult => {
    if (!cue.fallback || muted || masterVolume <= 0) return 'failed';
    try {
      const current = ensureContext();
      if (current.state !== 'running') return 'failed';
      const gain = current.createGain();
      const fallbackGain = Math.min(0.04, Math.max(0.0001, cue.fallback.gain));
      gain.connect(masterGain as GainNodeLike);
      const playback: ActivePlayback = {
        id,
        priority,
        baseGain: fallbackGain,
        gain,
        source: null as unknown as OscillatorLike,
        loop,
        requestRevision,
        lifecycleRevision: requestLifecycle,
      };

      const startPulse = () => {
        if (!active.has(playback) || !requestIsCurrent(id, requestRevision, requestLifecycle)) return;
        const oscillator = current.createOscillator();
        const startAt = current.currentTime + 0.008;
        oscillator.type = cue.fallback?.oscillatorType ?? 'sine';
        oscillator.frequency.setValueAtTime(cue.fallback?.frequency ?? 110, startAt);
        oscillator.connect(gain);
        playback.source = oscillator;
        oscillator.onended = () => {
          if (!active.has(playback)) return;
          if (playback.loop && requestIsCurrent(id, requestRevision, requestLifecycle)) {
            startPulse();
            return;
          }
          active.delete(playback);
          applyDucking();
        };
        oscillator.start(startAt);
        oscillator.stop(startAt + (cue.fallback?.durationSeconds ?? 0.08) + 0.02);
      };

      active.add(playback);
      applyDucking();
      startPulse();
      return 'fallback';
    } catch {
      return 'failed';
    }
  };

  const playCue = async (id: string, playOptions: PlayCueOptions = {}): Promise<SamplePlaybackResult> => {
    const cue = manifest[id];
    if (!cue) return 'failed';
    if (disposed) return 'cancelled';
    if (muted || masterVolume <= 0) return 'muted';
    const loop = playOptions.loop ?? cue.defaultLoop ?? false;
    if (loop) {
      invalidateCue(id);
      stopActiveCue(id);
    }
    const requestRevision = cueRevision(id);
    const requestLifecycle = lifecycleRevision;
    if (!(await arm())) return 'failed';
    if (!requestIsCurrent(id, requestRevision, requestLifecycle)) return 'cancelled';

    const startedAt = timestampMs(playOptions.startedAt);
    const positionAt = () => {
      const elapsed = startedAt === null ? 0 : (now() - startedAt) / 1000;
      const requested = elapsed + Math.max(0, playOptions.offsetSeconds ?? 0);
      return {
        startDelay: Math.max(0, -requested),
        position: Math.max(0, requested),
      };
    };
    const beforeLoad = positionAt();
    if (!loop && cue.maxAgeSeconds !== undefined && beforeLoad.position >= cue.maxAgeSeconds) {
      return 'expired';
    }

    const buffer = await preloadCue(id);
    if (!requestIsCurrent(id, requestRevision, requestLifecycle)) return 'cancelled';
    const afterLoad = positionAt();
    if (!loop && cue.maxAgeSeconds !== undefined && afterLoad.position >= cue.maxAgeSeconds) {
      return 'expired';
    }
    const priority = playOptions.priority ?? cue.defaultPriority;
    if (!buffer) {
      return playFallback(id, cue, loop, priority, requestRevision, requestLifecycle);
    }

    const current = ensureContext();
    const expiry = Math.min(buffer.duration, cue.maxAgeSeconds ?? buffer.duration);
    if (!loop && afterLoad.position >= expiry) return 'expired';
    const offset = loop && buffer.duration > 0
      ? afterLoad.position % buffer.duration
      : afterLoad.position;

    const source = current.createBufferSource();
    const cueGain = current.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(cueGain);
    cueGain.connect(masterGain as GainNodeLike);
    const playback: ActivePlayback = {
      id,
      priority,
      baseGain: clampVolume(cue.gain),
      gain: cueGain,
      source,
      loop,
      requestRevision,
      lifecycleRevision: requestLifecycle,
    };
    active.add(playback);
    applyDucking();
    source.onended = () => {
      active.delete(playback);
      applyDucking();
    };
    if (!requestIsCurrent(id, requestRevision, requestLifecycle)) {
      active.delete(playback);
      return 'cancelled';
    }
    source.start(current.currentTime + afterLoad.startDelay, offset);
    return 'played';
  };

  const stopCue = (id: string) => {
    invalidateCue(id);
    stopActiveCue(id);
  };

  const setMasterVolume = (value: number) => {
    masterVolume = clampVolume(value);
    applyMasterVolume();
  };

  const setMuted = (value: boolean) => {
    muted = Boolean(value);
    applyMasterVolume();
  };

  const dispose = () => {
    disposed = true;
    lifecycleRevision += 1;
    if (context) {
      for (const playback of [...active]) {
        try {
          playback.source.stop(context.currentTime);
        } catch {
          // Already stopped.
        }
      }
    }
    active.clear();
    decoded.clear();
    const current = context;
    context = null;
    masterGain = null;
    if (current) void current.close().catch(() => undefined);
  };

  return { arm, preloadCue, playCue, stopCue, setMasterVolume, setMuted, dispose };
}

export const sampleAudio = createSampleAudioController();

export const preloadCue = (id: AudioCueId) => sampleAudio.preloadCue(id);
export const playCue = (id: AudioCueId, options?: PlayCueOptions) => sampleAudio.playCue(id, options);
export const stopCue = (id: AudioCueId) => sampleAudio.stopCue(id);
export const setMasterVolume = (value: number) => sampleAudio.setMasterVolume(value);
export const setMuted = (value: boolean) => sampleAudio.setMuted(value);
