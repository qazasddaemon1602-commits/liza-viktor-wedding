// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(
  `${runtime.process.cwd()}/src/styles/bunker-projector-contrast.css`,
  'utf8',
).replace(/\s+/g, ' ');

describe('Bunker projector contrast', () => {
  it('keeps M01 primary copy high-contrast and separates it from the photo', () => {
    expect(css).toContain('.bunker-mission-one-screen {');
    expect(css).toContain('--projector-ink: #3b1221;');
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

  it('uses dark ink on warm paper for M01 and fallback mission panels', () => {
    expect(css).toContain('--projector-ink: #3b1221;');
    expect(css).toContain('--projector-muted: #684452;');
    expect(css).toContain('background: #fffaf2;');
    expect(css).toContain('--bq-paper: #fffaf2;');
    expect(css).toContain('--bq-ink: #3b1221;');
  });

  it('keeps M01 and fallback instructions at 22-24px with 18px secondary copy', () => {
    expect(css).toContain('font-size: clamp(22px, 1.45vw, 24px);');
    expect(css).toContain('font-size: clamp(18px, 1.1vw, 22px);');
  });

  it('guarantees FinalScreen attempt and hint copy an 18px minimum', () => {
    expect(css).toMatch(
      /\.bunker-v2-final-screen > main > span,\s*\.bunker-v2-final-screen > main > small\s*\{[^}]*font-size:\s*clamp\(18px,[^;]*22px\)/,
    );
  });
});
