// @ts-expect-error Vitest runs this asset contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ILYA_SONG_AUDIO_SOURCE } from './ilyaSong.service';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };

describe('Ilya song audio asset', () => {
  it('ships the complete supplied MP3 at the public player URL', () => {
    const bytes = readFileSync(`${runtime.process.cwd()}/public${ILYA_SONG_AUDIO_SOURCE}`);
    expect(bytes.byteLength).toBe(5_568_670);
    expect(bytes.subarray(0, 3).toString('ascii')).toBe('ID3');
  });
});
