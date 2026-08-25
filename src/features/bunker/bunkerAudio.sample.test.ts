import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECTOR_AUDIO_REARM_EVENT, siteAudio } from '../../lib/siteAudio';
import { createBunkerAudioController } from './bunkerAudio';

type FileSystem = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => Uint8Array;
};

const cwd = () => (globalThis as typeof globalThis & {
  process: { cwd: () => string };
}).process.cwd();
const audioPath = (relativePath: string) => `${cwd()}/public/audio/${relativePath}`;

async function fileSystem() {
  return vi.importActual<FileSystem>('node:fs');
}

async function readWav(relativePath: string) {
  const { readFileSync } = await fileSystem();
  const path = audioPath(relativePath);
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataBytes = view.getUint32(40, true);
  const durationSeconds = dataBytes / (sampleRate * channels * (bitsPerSample / 8));
  return { bitsPerSample, bytes, channels, durationSeconds, sampleRate };
}

function meanAbsoluteSample(bytes: Uint8Array, startSeconds: number, durationSeconds: number) {
  const bytesPerSecond = 48_000 * 2 * 2;
  const from = 44 + Math.floor(startSeconds * bytesPerSecond / 4) * 4;
  const to = Math.min(bytes.length, from + Math.floor(durationSeconds * bytesPerSecond / 4) * 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let total = 0;
  let samples = 0;
  for (let offset = from; offset < to; offset += 2) {
    total += Math.abs(view.getInt16(offset, true));
    samples += 1;
  }
  return total / Math.max(1, samples);
}

function rootMeanSquareSample(bytes: Uint8Array, startSeconds: number, durationSeconds: number) {
  const bytesPerSecond = 48_000 * 2 * 2;
  const from = 44 + Math.floor(startSeconds * bytesPerSecond / 4) * 4;
  const to = Math.min(bytes.length, from + Math.floor(durationSeconds * bytesPerSecond / 4) * 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let totalSquares = 0;
  let samples = 0;
  for (let offset = from; offset < to; offset += 2) {
    const sample = view.getInt16(offset, true) / 32_768;
    totalSquares += sample * sample;
    samples += 1;
  }
  return Math.sqrt(totalSquares / Math.max(1, samples));
}

describe('Bunker sample audio bridge', () => {
  beforeEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
  });

  afterEach(() => {
    siteAudio.setVolume(0.75);
    siteAudio.setEnabled(true);
  });

  it('plays and stops the acquired alarm loop on the shared timestamp-capable bus', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({
      samplePlayer,
      hasSample: () => true,
    });

    await expect(audio.arm()).resolves.toBe(true);
    audio.startAlarm();
    audio.stopAlarm();

    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.alarm', {
      loop: true,
      priority: 'major',
    });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.alarm');
    audio.dispose();
  });

  it('retries a blocked requested sample alarm after the projector is rearmed', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn()
        .mockResolvedValueOnce('failed' as const)
        .mockResolvedValueOnce('played' as const),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAlarm();
    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));

    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(2));
    audio.dispose();
  });

  it('runs the generated Bunker mission music as a scene loop and exposes the recorded door hit', () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAmbience();
    audio.playDoorUnlock();
    audio.stopAmbience();

    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.ambience', {
      loop: true,
      priority: 'scene',
    });
    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.door', {
      priority: 'major',
    });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.ambience');
    audio.dispose();
  });

  it('exposes the existing local reveal cue for the post-door sequence', () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.playReveal();

    expect(samplePlayer.playCue).toHaveBeenCalledWith('ui.reveal', {
      priority: 'scene',
    });
    audio.dispose();
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('ui.reveal');
  });

  it('exposes the existing success cue and suppresses it while locally muted', () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.playSuccess();
    expect(samplePlayer.playCue).toHaveBeenCalledWith('ui.success', { priority: 'scene' });

    siteAudio.setEnabled(false);
    audio.playSuccess();
    expect(samplePlayer.playCue).toHaveBeenCalledTimes(1);
    audio.dispose();
  });

  it('exposes the original finale cue without owning its screen lifecycle', () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.playFinale();
    audio.stopFinale();

    expect(samplePlayer.playCue).toHaveBeenCalledWith('bunker.finale', {
      priority: 'scene',
    });
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.finale');
    audio.dispose();
  });

  it('ships a stereo mission loop and a distinct 40-50 second stereo finale', async () => {
    const { existsSync } = await fileSystem();
    const finalePath = audioPath('bunker/finale.wav');
    expect(existsSync(finalePath)).toBe(true);

    const mission = await readWav('bunker/ambience.wav');
    const finale = await readWav('bunker/finale.wav');
    expect(mission).toMatchObject({ bitsPerSample: 16, channels: 2, sampleRate: 48_000 });
    expect(mission.durationSeconds).toBeGreaterThanOrEqual(16);
    expect(mission.durationSeconds).toBeLessThanOrEqual(32);
    expect(finale).toMatchObject({ bitsPerSample: 16, channels: 2, sampleRate: 48_000 });
    expect(finale.durationSeconds).toBeGreaterThanOrEqual(40);
    expect(finale.durationSeconds).toBeLessThanOrEqual(50);
    expect(Array.from(finale.bytes.slice(44, 2_048))).not.toEqual(
      Array.from(mission.bytes.slice(44, 2_048)),
    );
  });

  it('bakes a quiet fade-in and fade-out into the finale file', async () => {
    const { existsSync } = await fileSystem();
    const finalePath = audioPath('bunker/finale.wav');
    if (!existsSync(finalePath)) {
      expect(existsSync(finalePath)).toBe(true);
      return;
    }
    const finale = await readWav('bunker/finale.wav');
    const middle = meanAbsoluteSample(finale.bytes, finale.durationSeconds / 2, 1);

    expect(meanAbsoluteSample(finale.bytes, 0, 0.25)).toBeLessThan(middle * 0.2);
    expect(meanAbsoluteSample(finale.bytes, finale.durationSeconds - 0.25, 0.25)).toBeLessThan(middle * 0.2);
  });

  it('keeps mission-music energy continuous across the loop boundary', async () => {
    const mission = await readWav('bunker/ambience.wav');
    const boundaryWindowSeconds = 0.1;
    const leadingRms = rootMeanSquareSample(mission.bytes, 0, boundaryWindowSeconds);
    const trailingRms = rootMeanSquareSample(
      mission.bytes,
      mission.durationSeconds - boundaryWindowSeconds,
      boundaryWindowSeconds,
    );

    expect(trailingRms / leadingRms).toBeGreaterThan(0.65);
    expect(trailingRms / leadingRms).toBeLessThan(1.55);
  });

  it('does not restart mission music that is already playing when projector audio is rearmed', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAmbience();
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));

    await vi.waitFor(() => expect(samplePlayer.arm).toHaveBeenCalled());
    expect(samplePlayer.playCue).toHaveBeenCalledTimes(1);
    audio.dispose();
  });

  it('retries blocked mission music only when projector audio is explicitly rearmed', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn()
        .mockResolvedValueOnce('failed' as const)
        .mockResolvedValueOnce('played' as const),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAmbience();
    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(samplePlayer.playCue).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));

    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(2));
    audio.dispose();
  });

  it('deduplicates finale requests and retries a blocked finale only on explicit re-arm', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn()
        .mockResolvedValueOnce('failed' as const)
        .mockResolvedValueOnce('played' as const),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.playFinale();
    audio.playFinale();

    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(2));
    audio.dispose();
  });

  it('stops requested samples on local mute and resumes them only after explicit re-arm', async () => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn().mockResolvedValue('played' as const),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAlarm();
    audio.startAmbience();
    audio.playFinale();
    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(3));
    samplePlayer.stopCue.mockClear();

    siteAudio.setEnabled(false);

    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.alarm');
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.ambience');
    expect(samplePlayer.stopCue).toHaveBeenCalledWith('bunker.finale');
    siteAudio.setEnabled(true);
    await Promise.resolve();
    expect(samplePlayer.playCue).toHaveBeenCalledTimes(3);

    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(6));
    audio.dispose();
  });

  it.each([
    ['alarm', (audio: ReturnType<typeof createBunkerAudioController>) => audio.startAlarm()],
    ['ambience', (audio: ReturnType<typeof createBunkerAudioController>) => audio.startAmbience()],
    ['finale', (audio: ReturnType<typeof createBunkerAudioController>) => audio.playFinale()],
  ])('recovers a rejected %s request only after explicit re-arm', async (_label, request) => {
    const samplePlayer = {
      arm: vi.fn().mockResolvedValue(true),
      playCue: vi.fn()
        .mockRejectedValueOnce(new Error('autoplay rejected'))
        .mockResolvedValueOnce('played' as const),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    request(audio);
    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));

    await vi.waitFor(() => expect(samplePlayer.playCue).toHaveBeenCalledTimes(2));
    audio.dispose();
  });

  it('does not restart a requested alarm when a pending projector rearm resolves after dispose', async () => {
    let resolveArm: ((value: boolean) => void) | undefined;
    const samplePlayer = {
      arm: vi.fn().mockImplementation(() => new Promise<boolean>((resolve) => { resolveArm = resolve; })),
      playCue: vi.fn().mockResolvedValue('played'),
      stopCue: vi.fn(),
    };
    const audio = createBunkerAudioController({ samplePlayer, hasSample: () => true });

    audio.startAlarm();
    window.dispatchEvent(new Event(PROJECTOR_AUDIO_REARM_EVENT));
    audio.dispose();
    resolveArm?.(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(samplePlayer.playCue).toHaveBeenCalledTimes(1);
  });
});
