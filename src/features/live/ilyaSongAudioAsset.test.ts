// @ts-expect-error Vitest runs this asset contract in Node; the browser app intentionally omits Node types.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WEDDING_MUSIC_TRACKS } from './ilyaSong.service';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };

describe('Ilya song audio asset', () => {
  it('ships every complete supplied MP3 at its public player URL', () => {
    const expectedBytes = new Map([
      ['ilya-toast', 5_568_670],
      ['koshkin-dom', 7_874_674],
      ['koshkin-dom-2', 7_966_864],
      ['koshkin-dom-3', 8_109_050],
      ['last-route', 5_136_412],
    ]);

    for (const track of WEDDING_MUSIC_TRACKS) {
      const path = `${runtime.process.cwd()}/public${track.audioSource}`;
      expect(existsSync(path), `${track.title} is missing`).toBe(true);
      if (!existsSync(path)) continue;
      const bytes = readFileSync(path);
      expect(bytes.byteLength, track.title).toBe(expectedBytes.get(track.id));
      expect(bytes.subarray(0, 3).toString('ascii'), track.title).toBe('ID3');
    }
  });
});
