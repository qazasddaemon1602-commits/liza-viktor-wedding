// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { readFileSync, readdirSync, statSync } from 'node:fs';
// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const quizRoot = resolve(testRuntime.process.cwd(), 'public/images/quiz');
const stems = Array.from({ length: 30 }, (_, index) => `q${String(index + 1).padStart(2, '0')}`);

type Dimensions = { width: number; height: number };

function readUInt24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDimensions(path: string): Dimensions {
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 4).toString('ascii'), `${path} must be a RIFF file`).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('ascii'), `${path} must identify as WebP`).toBe('WEBP');

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
      expect(bytes.subarray(dataOffset + 3, dataOffset + 6).toString('hex'), `${path} must contain a VP8 key frame`).toBe('9d012a');
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5) {
      expect(bytes[dataOffset], `${path} must contain a VP8L signature`).toBe(0x2f);
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
  expect(bytes.subarray(4, 8).toString('ascii'), `${path} must begin with an ftyp box`).toBe('ftyp');
  const brands = bytes.subarray(8, Math.min(bytes.length, 64)).toString('ascii');
  expect(/avif|avis/.test(brands), `${path} must advertise an AVIF brand`).toBe(true);

  for (let offset = 0; offset + 20 <= bytes.length; offset += 1) {
    if (bytes.subarray(offset + 4, offset + 8).toString('ascii') !== 'ispe') continue;
    const boxSize = bytes.readUInt32BE(offset);
    if (boxSize < 20 || offset + boxSize > bytes.length) continue;
    return {
      width: bytes.readUInt32BE(offset + 12),
      height: bytes.readUInt32BE(offset + 16),
    };
  }

  throw new Error(`${path} has no complete AVIF image spatial-extents box`);
}

function expectEditorialLandscape(dimensions: Dimensions, file: string) {
  expect(dimensions.width, `${file} width`).toBeGreaterThan(0);
  expect(dimensions.height, `${file} height`).toBeGreaterThan(0);
  const ratio = dimensions.width / dimensions.height;
  expect(ratio, `${file} must remain a landscape 3:2-ish crop`).toBeGreaterThanOrEqual(1.45);
  expect(ratio, `${file} must remain a landscape 3:2-ish crop`).toBeLessThanOrEqual(1.55);
}

describe('quiz generated image delivery contract', () => {
  it('ships exactly 30 paired WebP and AVIF question images', () => {
    const delivered = readdirSync(quizRoot)
      .filter((file: string) => /^q\d{2}\.(?:avif|webp)$/.test(file))
      .sort();
    const expected = stems.flatMap((stem) => [`${stem}.avif`, `${stem}.webp`]).sort();

    expect(delivered).toEqual(expected);
  });

  for (const stem of stems) {
    it(`keeps ${stem} non-empty, decodable and dimensionally paired`, () => {
      const webpPath = resolve(quizRoot, `${stem}.webp`);
      const avifPath = resolve(quizRoot, `${stem}.avif`);
      expect(statSync(webpPath).size, `${stem}.webp must not be empty`).toBeGreaterThan(0);
      expect(statSync(avifPath).size, `${stem}.avif must not be empty`).toBeGreaterThan(0);

      const webp = webpDimensions(webpPath);
      const avif = avifDimensions(avifPath);
      expectEditorialLandscape(webp, `${stem}.webp`);
      expectEditorialLandscape(avif, `${stem}.avif`);
      expect(avif, `${stem} candidates must describe the same crop`).toEqual(webp);
    });
  }
});
