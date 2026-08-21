import { describe, expect, it, vi } from 'vitest';
import {
  createSampleAudioController,
  type AudioCueDefinition,
  type SampleAudioContextLike,
} from './sampleAudio';

const TEST_MANIFEST = {
  ambience: cue('ambience', '/audio/test/ambience.ogg', 'scene', true),
  impact: cue('impact', '/audio/test/impact.ogg', 'major'),
  ui: cue('ui', '/audio/test/ui.ogg', 'ui'),
  missing: { ...cue('missing', '/audio/test/missing.ogg', 'scene'), maxAgeSeconds: 1 },
} satisfies Record<string, AudioCueDefinition>;

function cue(
  id: string,
  src: `/audio/${string}`,
  priority: AudioCueDefinition['defaultPriority'],
  loop = false,
): AudioCueDefinition {
  return {
    id,
    src,
    sourceType: 'recording',
    defaultPriority: priority,
    defaultLoop: loop,
    gain: 0.8,
    fallback: { frequency: 110, durationSeconds: 0.08, gain: 0.01 },
    attribution: { license: 'CC0-1.0', status: 'verified' },
  };
}

function fakeAudioContext(duration = 10) {
  const sources: Array<{
    buffer: { duration: number } | null;
    loop: boolean;
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
  const oscillators: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }> = [];
  const context = {
    currentTime: 20,
    state: 'running',
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn().mockResolvedValue({ duration }),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as { duration: number } | null,
        loop: false,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(source);
      return source;
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
  } satisfies SampleAudioContextLike;

  return { context, sources, gains, oscillators };
}

function successfulFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe('sample audio controller', () => {
  it('fetches and decodes a cue once, then reuses the decoded buffer', async () => {
    const { context, sources } = fakeAudioContext();
    const fetcher = successfulFetch();
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher,
      manifest: TEST_MANIFEST,
    });

    await audio.preloadCue('ui');
    await audio.preloadCue('ui');
    await audio.playCue('ui');

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].buffer).toEqual({ duration: 10 });
  });

  it('applies master volume immediately and prevents playback while muted', async () => {
    const { context, sources, gains } = fakeAudioContext();
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
    });

    audio.setMasterVolume(0.35);
    await audio.preloadCue('ui');
    expect(gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0.35, context.currentTime);

    audio.setMuted(true);
    expect(gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, context.currentTime);
    await expect(audio.playCue('ui')).resolves.toBe('muted');
    expect(sources).toHaveLength(0);
  });

  it('ducks a lower-priority active cue and restores it after the major cue ends', async () => {
    const { context, sources, gains } = fakeAudioContext();
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
    });

    await audio.playCue('ambience', { loop: true, priority: 'scene' });
    const ambienceGain = gains[1];
    await audio.playCue('impact', { priority: 'major' });

    expect(ambienceGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.2, context.currentTime);
    sources[1].onended?.();
    expect(ambienceGain.gain.setValueAtTime).toHaveBeenLastCalledWith(0.8, context.currentTime);
  });

  it('derives playback offset from the server timestamp and suppresses expired one-shots', async () => {
    const { context, sources } = fakeAudioContext(10);
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
      now: () => 15_000,
    });

    await expect(audio.playCue('impact', { startedAt: 3_000 })).resolves.toBe('expired');
    expect(sources).toHaveLength(0);

    await expect(audio.playCue('ambience', {
      startedAt: 3_000,
      offsetSeconds: 1,
      loop: true,
    })).resolves.toBe('played');
    expect(sources[0].loop).toBe(true);
    expect(sources[0].start).toHaveBeenCalledWith(context.currentTime, 3);
  });

  it('uses a quiet oscillator only after a local sample fails and stopCue stops active loops', async () => {
    const { context, sources, oscillators } = fakeAudioContext();
    const fetcher = successfulFetch();
    fetcher.mockResolvedValueOnce({ ok: false, arrayBuffer: vi.fn() });
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher,
      manifest: TEST_MANIFEST,
    });

    await expect(audio.playCue('missing')).resolves.toBe('fallback');
    expect(oscillators).toHaveLength(1);

    await expect(audio.playCue('ambience', { loop: true })).resolves.toBe('played');
    expect(oscillators).toHaveLength(1);
    audio.stopCue('ambience');
    expect(sources[0].stop).toHaveBeenCalledWith(context.currentTime);
  });

  it('does not replay an expired fallback one-shot after reconnect', async () => {
    const { context, oscillators } = fakeAudioContext();
    const fetcher = vi.fn().mockResolvedValue({ ok: false, arrayBuffer: vi.fn() });
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher,
      manifest: TEST_MANIFEST,
      now: () => 8_000,
    });

    await expect(audio.playCue('missing', { startedAt: 2_000 })).resolves.toBe('expired');
    expect(fetcher).not.toHaveBeenCalled();
    expect(oscillators).toHaveLength(0);
  });

  it('does not start a loop when stopCue cancels it during decode', async () => {
    const { context, sources } = fakeAudioContext();
    const decoding = deferred<{ duration: number }>();
    context.decodeAudioData = vi.fn(() => decoding.promise);
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
    });

    const playing = audio.playCue('ambience', { loop: true });
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(1));
    audio.stopCue('ambience');
    decoding.resolve({ duration: 10 });

    await expect(playing).resolves.toBe('cancelled');
    expect(sources).toHaveLength(0);
  });

  it('does not start an in-flight cue after dispose', async () => {
    const { context, sources } = fakeAudioContext();
    const decoding = deferred<{ duration: number }>();
    context.decodeAudioData = vi.fn(() => decoding.promise);
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
    });

    const playing = audio.playCue('ambience', { loop: true });
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(1));
    audio.dispose();
    decoding.resolve({ duration: 10 });

    await expect(playing).resolves.toBe('cancelled');
    expect(sources).toHaveLength(0);
  });

  it('recomputes a loop offset after slow decoding completes', async () => {
    const { context, sources } = fakeAudioContext();
    const decoding = deferred<{ duration: number }>();
    context.decodeAudioData = vi.fn(() => decoding.promise);
    let clock = 1_000;
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
      now: () => clock,
    });

    const playing = audio.playCue('ambience', { startedAt: 0, loop: true });
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(1));
    clock = 4_000;
    decoding.resolve({ duration: 10 });

    await expect(playing).resolves.toBe('played');
    expect(sources[0].start).toHaveBeenCalledWith(context.currentTime, 4);
  });

  it('expires a one-shot when it becomes stale during slow decoding', async () => {
    const { context, sources } = fakeAudioContext();
    const decoding = deferred<{ duration: number }>();
    context.decodeAudioData = vi.fn(() => decoding.promise);
    let clock = 1_000;
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: successfulFetch(),
      manifest: TEST_MANIFEST,
      now: () => clock,
    });

    const playing = audio.playCue('impact', { startedAt: 0 });
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(1));
    clock = 4_000;
    decoding.resolve({ duration: 3 });

    await expect(playing).resolves.toBe('expired');
    expect(sources).toHaveLength(0);
  });

  it('keeps fallback loops addressable and priority-ducked until stopCue', async () => {
    const { context, gains, oscillators } = fakeAudioContext();
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher: vi.fn().mockResolvedValue({ ok: false, arrayBuffer: vi.fn() }),
      manifest: TEST_MANIFEST,
    });

    await expect(audio.playCue('ambience', { loop: true, priority: 'scene' })).resolves.toBe('fallback');
    await expect(audio.playCue('impact', { priority: 'major' })).resolves.toBe('fallback');
    expect(gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0.0025, context.currentTime);

    audio.stopCue('impact');
    expect(oscillators[1].stop).toHaveBeenCalledWith(context.currentTime);
    expect(gains[1].gain.setValueAtTime).toHaveBeenLastCalledWith(0.01, context.currentTime);

    oscillators[0].onended?.();
    expect(oscillators).toHaveLength(3);
    audio.stopCue('ambience');
    expect(oscillators[2].stop).toHaveBeenCalledWith(context.currentTime);
    oscillators[2].onended?.();
    expect(oscillators).toHaveLength(3);
  });

  it('retries a failed local load on the next explicit play', async () => {
    const { context, sources } = fakeAudioContext();
    const fetcher = successfulFetch();
    fetcher.mockResolvedValueOnce({ ok: false, arrayBuffer: vi.fn() });
    const audio = createSampleAudioController({
      contextFactory: () => context,
      fetcher,
      manifest: TEST_MANIFEST,
    });

    await expect(audio.playCue('ui')).resolves.toBe('fallback');
    await expect(audio.playCue('ui')).resolves.toBe('played');

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sources).toHaveLength(1);
  });
});
