import { describe, expect, it, vi } from 'vitest';

type FileSystem = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => Uint8Array;
};

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };

describe('quiz projector music asset', () => {
  it('ships a 20-30 second stereo 48 kHz loop', async () => {
    const { existsSync, readFileSync } = await vi.importActual<FileSystem>('node:fs');
    const path = `${runtime.process.cwd()}/public/audio/quiz/ambience.wav`;
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const bytes = readFileSync(path);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const dataBytes = view.getUint32(40, true);
    const durationSeconds = dataBytes / (sampleRate * channels * (bitsPerSample / 8));

    expect({ bitsPerSample, channels, sampleRate }).toEqual({ bitsPerSample: 16, channels: 2, sampleRate: 48_000 });
    expect(durationSeconds).toBeGreaterThanOrEqual(20);
    expect(durationSeconds).toBeLessThanOrEqual(30);
  });
});
