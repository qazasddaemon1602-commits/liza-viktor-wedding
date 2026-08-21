// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
// @ts-expect-error Vitest runs this contract in Node; the browser app deliberately omits Node types.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string; env: Record<string, string | undefined> };
};

const imageRoot = resolve(
  testRuntime.process.cwd(),
  testRuntime.process.env.IMAGE_ASSET_ROOT ?? 'public/images',
);

type AssetContract = {
  stem: string;
  width: number;
  height: number;
  responsiveWidths: readonly number[];
  avifBudget: number;
  webpBudget: number;
};

const tvAsset = (stem: string): AssetContract => ({
  stem,
  width: 1920,
  height: 1080,
  responsiveWidths: [960, 1920],
  avifBudget: 280_000,
  webpBudget: 500_000,
});

const evidenceAsset = (stem: string): AssetContract => ({
  stem,
  width: 960,
  height: 720,
  responsiveWidths: [480, 960],
  avifBudget: 150_000,
  webpBudget: 260_000,
});

const assets: readonly AssetContract[] = [
  {
    stem: 'tunnel-relief-wide',
    width: 1920,
    height: 600,
    responsiveWidths: [960, 1920],
    avifBudget: 260_000,
    webpBudget: 460_000,
  },
  {
    stem: 'tunnel-relief-mobile',
    width: 960,
    height: 720,
    responsiveWidths: [480, 960],
    avifBudget: 150_000,
    webpBudget: 260_000,
  },
  tvAsset('train-tunnel'),
  tvAsset('bunker-exterior'),
  tvAsset('bunker-door-closed'),
  tvAsset('bunker-door-open'),
  ...Array.from({ length: 6 }, (_, index) => evidenceAsset(
    `evidence-${String(index + 1).padStart(2, '0')}`,
  )),
  {
    stem: 'tunnel-map-master',
    width: 1920,
    height: 640,
    responsiveWidths: [960, 1920],
    avifBudget: 280_000,
    webpBudget: 500_000,
  },
  evidenceAsset('archive-bk17'),
  evidenceAsset('archive-card'),
  evidenceAsset('archive-document'),
];

function imagePath(file: string) {
  return resolve(imageRoot, 'bunker', file);
}

function requiredSize(file: string): number {
  const path = imagePath(file);
  expect(existsSync(path), `missing ${file} under ${imageRoot}`).toBe(true);
  return existsSync(path) ? statSync(path).size : 0;
}

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

describe('Bunker generated image delivery contract', () => {
  it('does not ship temporary Task 8 conversion artifacts', () => {
    expect(readdirSync(resolve(imageRoot, 'bunker')).filter((file: string) => file.includes('.task8-tmp'))).toEqual([]);
  });
  it('keeps every canonical PNG at its measured crop dimensions', () => {
    const missing = assets
      .map(({ stem }) => `${stem}.png`)
      .filter((file) => !existsSync(imagePath(file)));
    expect(missing, `missing canonical Bunker images under ${imageRoot}`).toEqual([]);

    for (const asset of assets) {
      expect(pngDimensions(imagePath(`${asset.stem}.png`)), asset.stem).toEqual({
        width: asset.width,
        height: asset.height,
      });
    }
  });

  it('provides non-empty AVIF and WebP candidates beside every canonical image', () => {
    const responsive = assets.flatMap((asset) => asset.responsiveWidths.flatMap((width) => [
      `${asset.stem}-${width}.avif`,
      `${asset.stem}-${width}.webp`,
    ]));
    const missing = responsive.filter((file) => !existsSync(imagePath(file)));

    expect(missing, `missing responsive Bunker images under ${imageRoot}`).toEqual([]);
    for (const file of responsive) {
      expect(statSync(imagePath(file)).size, file).toBeGreaterThan(0);
    }
  });

  for (const asset of assets) {
    const largest = asset.responsiveWidths.at(-1)!;
    it(`keeps ${asset.stem} modern-format candidates within transfer budgets`, () => {
      expect(requiredSize(`${asset.stem}-${largest}.avif`)).toBeLessThanOrEqual(
        asset.avifBudget,
      );
      expect(requiredSize(`${asset.stem}-${largest}.webp`)).toBeLessThanOrEqual(
        asset.webpBudget,
      );
    });
  }

  it('keeps the final TV map-plus-door critical path within scene budgets', () => {
    const avifBytes = ['tunnel-map-master-1920.avif', 'bunker-door-closed-1920.avif']
      .reduce((total, file) => total + requiredSize(file), 0);
    const webpBytes = ['tunnel-map-master-1920.webp', 'bunker-door-closed-1920.webp']
      .reduce((total, file) => total + requiredSize(file), 0);

    expect(avifBytes).toBeLessThanOrEqual(520_000);
    expect(webpBytes).toBeLessThanOrEqual(920_000);
  });
});
