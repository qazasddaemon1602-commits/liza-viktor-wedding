// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { existsSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string; env: Record<string, string | undefined> };
};

const imageRoot = resolve(
  testRuntime.process.cwd(),
  testRuntime.process.env.IMAGE_ASSET_ROOT ?? 'public/images',
  'tournament',
);

const assets = [
  { stem: 'arena-wide', width: 1672, height: 941, responsiveWidths: [960, 1672], avifBudget: 300_000, webpBudget: 520_000 },
  { stem: 'arena-mobile', width: 1086, height: 1448, responsiveWidths: [720, 1086], avifBudget: 300_000, webpBudget: 520_000 },
  { stem: 'arena-fight-wide', width: 1672, height: 941, responsiveWidths: [960, 1672], avifBudget: 300_000, webpBudget: 520_000 },
  { stem: 'arena-fight-mobile', width: 1086, height: 1448, responsiveWidths: [720, 1086], avifBudget: 300_000, webpBudget: 520_000 },
  { stem: 'champion-hall', width: 1672, height: 941, responsiveWidths: [960, 1672], avifBudget: 300_000, webpBudget: 520_000 },
  { stem: 'stone-texture', width: 1254, height: 1254, responsiveWidths: [640, 1254], avifBudget: 240_000, webpBudget: 420_000 },
] as const;

function pngDimensions(path: string) {
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(
    png.subarray(-12).toString('hex'),
    `${path} must end with a complete PNG IEND chunk`,
  ).toBe('0000000049454e44ae426082');

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe('tournament generated image delivery contract', () => {
  it('keeps the six approved production PNGs complete and at their measured crop dimensions', () => {
    const missing = assets
      .map(({ stem }) => `${stem}.png`)
      .filter((file) => !existsSync(resolve(imageRoot, file)));

    expect(missing, `missing tournament images under ${imageRoot}`).toEqual([]);

    for (const asset of assets) {
      expect(pngDimensions(resolve(imageRoot, `${asset.stem}.png`)), asset.stem).toEqual({
        width: asset.width,
        height: asset.height,
      });
    }
  });

  it('provides bounded AVIF and WebP candidates for every production plate', () => {
    for (const asset of assets) {
      for (const width of asset.responsiveWidths) {
        for (const format of ['avif', 'webp'] as const) {
          const file = resolve(imageRoot, `${asset.stem}-${width}.${format}`);
          expect(existsSync(file), file).toBe(true);
          expect(statSync(file).size, file).toBeGreaterThan(0);
        }
      }
      const largest = asset.responsiveWidths.at(-1)!;
      expect(statSync(resolve(imageRoot, `${asset.stem}-${largest}.avif`)).size).toBeLessThanOrEqual(asset.avifBudget);
      expect(statSync(resolve(imageRoot, `${asset.stem}-${largest}.webp`)).size).toBeLessThanOrEqual(asset.webpBudget);
    }
  });
});
