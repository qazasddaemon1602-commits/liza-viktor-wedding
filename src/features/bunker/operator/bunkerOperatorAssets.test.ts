// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { readFileSync, readdirSync, statSync } from 'node:fs';
// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const storyRoot = resolve(testRuntime.process.cwd(), 'public/images/bunker/story');
const stems = [
  'liza-operator',
  'viktor-route',
  'train-chief',
  'liza-reveal',
  'couple-epilogue',
] as const;

type Dimensions = { width: number; height: number };

function readUInt24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDimensions(path: string): Dimensions {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 4).toString('ascii'), `${path} must be RIFF`).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii'), `${path} must be WebP`).toBe('WEBP');

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    expect(dataOffset + chunkSize, `${path} contains a truncated ${chunkType} chunk`).toBeLessThanOrEqual(bytes.length);
    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: readUInt24LE(bytes, dataOffset + 4) + 1,
        height: readUInt24LE(bytes, dataOffset + 7) + 1,
      };
    }
    if (chunkType === 'VP8 ' && chunkSize >= 10) {
      expect(bytes.subarray(dataOffset + 3, dataOffset + 6).toString('hex')).toBe('9d012a');
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    if (chunkType === 'VP8L' && chunkSize >= 5) {
      expect(bytes[dataOffset]).toBe(0x2f);
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height: 1 + (bytes[dataOffset + 2] >> 6) + (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  throw new Error(`${path} has no decodable WebP image chunk`);
}

function avifDimensions(path: string): Dimensions {
  const bytes = readFileSync(path);
  expect(bytes.subarray(4, 8).toString('ascii'), `${path} must begin with ftyp`).toBe('ftyp');
  expect(bytes.subarray(8, Math.min(bytes.length, 64)).toString('ascii')).toMatch(/avif|avis/);
  for (let offset = 0; offset + 20 <= bytes.length; offset += 1) {
    if (bytes.subarray(offset + 4, offset + 8).toString('ascii') !== 'ispe') continue;
    const boxSize = bytes.readUInt32BE(offset);
    if (boxSize < 20 || offset + boxSize > bytes.length) continue;
    return {
      width: bytes.readUInt32BE(offset + 12),
      height: bytes.readUInt32BE(offset + 16),
    };
  }
  throw new Error(`${path} has no complete AVIF spatial-extents box`);
}

describe('Bunker operator story media contract', () => {
  it('ships exactly five paired AVIF and WebP story images', () => {
    const delivered = readdirSync(storyRoot).filter((file: string) => /\.(?:avif|webp)$/.test(file)).sort();
    expect(delivered).toEqual(stems.flatMap((stem) => [`${stem}.avif`, `${stem}.webp`]).sort());
  });

  for (const stem of stems) {
    it(`keeps ${stem} valid, paired and presentation-ready`, () => {
      const avifPath = resolve(storyRoot, `${stem}.avif`);
      const webpPath = resolve(storyRoot, `${stem}.webp`);
      expect(statSync(avifPath).size, `${stem}.avif must not be empty`).toBeGreaterThan(0);
      expect(statSync(webpPath).size, `${stem}.webp must not be empty`).toBeGreaterThan(0);
      const avif = avifDimensions(avifPath);
      const webp = webpDimensions(webpPath);
      expect(avif).toEqual(webp);
      expect(Math.max(avif.width, avif.height), `${stem} long edge`).toBeGreaterThanOrEqual(1_200);
    });
  }
});
