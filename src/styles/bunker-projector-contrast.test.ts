// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(
  `${runtime.process.cwd()}/src/styles/bunker-projector-contrast.css`,
  'utf8',
).replace(/\s+/g, ' ');

describe('Bunker projector contrast', () => {
  it('keeps M01 primary copy bright and separates it from the photo', () => {
    expect(css).toContain('.bunker-mission-one-screen {');
    expect(css).toContain('--projector-ink: #f7f3e9;');
    expect(css).toContain('.bunker-mission-one-screen::before');
    expect(css).toContain('.bunker-mission-one-screen__summary');
    expect(css).toContain('.bunker-mission-one-screen__wagons li');
  });

  it('raises shared TV mission contrast without changing phone mission styling', () => {
    expect(css).toContain('.bunker-quest-scene {');
    expect(css).toContain('.bunker-quest-scene__story p');
    expect(css).toContain('.bunker-quest-scene__teams article');
    expect(css).not.toContain('.bunker-v2-mission {');
    expect(css).not.toContain('.guest-bunker-quest {');
  });
});
