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
);

const transferGroups = [
  {
    name: 'wedding editorial AVIF critical path',
    budget: 800_000,
    files: [
      'wedding/editorial-hero-1122.avif',
      'wedding/editorial-story-1122.avif',
      'wedding/editorial-venue-1122.avif',
      'wedding/editorial-ticket-still-1672.avif',
    ],
  },
  {
    name: 'wedding editorial WebP critical path',
    budget: 1_400_000,
    files: [
      'wedding/editorial-hero-1122.webp',
      'wedding/editorial-story-1122.webp',
      'wedding/editorial-venue-1122.webp',
      'wedding/editorial-ticket-still-1672.webp',
    ],
  },
  {
    name: 'mobile ticket AVIF',
    budget: 300_000,
    files: [
      'ticket/paper-texture-512.avif',
      'ticket/railway-seal-128.avif',
      'ticket/locomotive-engraving-480.avif',
      'ticket/tyumen-skyline-engraving-960.avif',
    ],
  },
  {
    name: 'mobile ticket WebP fallback',
    budget: 500_000,
    files: [
      'ticket/paper-texture-512.webp',
      'ticket/railway-seal-128.webp',
      'ticket/locomotive-engraving-480.webp',
      'ticket/tyumen-skyline-engraving-960.webp',
    ],
  },
  {
    name: 'idle TV ticket AVIF',
    budget: 700_000,
    files: [
      'ticket/paper-texture-1024.avif',
      'ticket/railway-seal-256.avif',
      'ticket/locomotive-engraving-960.avif',
      'ticket/tyumen-skyline-engraving-1600.avif',
    ],
  },
  {
    name: 'arrival TV AVIF',
    budget: 600_000,
    files: [
      'ticket/paper-texture-1024.avif',
      'ticket/railway-seal-256.avif',
      'wedding/train-arrival-wide-1920.avif',
    ],
  },
  {
    name: 'arrival TV WebP fallback',
    budget: 900_000,
    files: [
      'ticket/paper-texture-1024.webp',
      'ticket/railway-seal-256.webp',
      'wedding/train-arrival-wide-1920.webp',
    ],
  },
] as const;

function pngDimensions(path: string) {
  const png = readFileSync(path);
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

describe('generated image delivery contract', () => {
  it('keeps the canonical arrival plate at a desktop crop-safe ratio', () => {
    const path = resolve(imageRoot, 'wedding/train-arrival-wide.png');
    const { width, height } = pngDimensions(path);

    expect(width).toBeGreaterThanOrEqual(1920);
    expect(width / height).toBeGreaterThanOrEqual(3.55);
  });

  for (const group of transferGroups) {
    it(`keeps the ${group.name} critical path within ${group.budget} bytes`, () => {
      const missing = group.files.filter((file) => !existsSync(resolve(imageRoot, file)));
      expect(missing, `missing responsive image files under ${imageRoot}`).toEqual([]);

      const bytes = group.files.reduce((total, file) => total + statSync(resolve(imageRoot, file)).size, 0);
      expect(bytes).toBeLessThanOrEqual(group.budget);
    });
  }
});
