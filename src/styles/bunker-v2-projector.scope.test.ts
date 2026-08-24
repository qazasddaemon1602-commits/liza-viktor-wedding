// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${runtime.process.cwd()}/src/styles/bunker-v2-projector.css`, 'utf8').replace(/\r\n/g, '\n');
const main = readFileSync(`${runtime.process.cwd()}/src/main.tsx`, 'utf8');

function body(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches.length, `missing CSS rule for ${selector}`).toBeGreaterThan(0);
  return matches.map((match) => match[1]).join('\n');
}

describe('Bunker V2 projector layout', () => {
  it('owns exactly one TV viewport instead of falling through to global page styles', () => {
    const shell = body('.bunker-v2-screen');
    expect(shell).toMatch(/position:\s*fixed/);
    expect(shell).toMatch(/inset:\s*0/);
    expect(shell).toMatch(/height:\s*100dvh/);
    expect(shell).toMatch(/overflow:\s*hidden/);
    expect(shell).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/);
    expect(css).toMatch(/html:has\(\.bunker-v2-screen\),\s*body:has\(\.bunker-v2-screen\)\s*\{[^}]*overflow:\s*hidden/);
  });

  it('keeps mission headings fluid in both width and height', () => {
    const heading = body('.bunker-v2-screen > header h1');
    expect(heading).toMatch(/font:[^;]*clamp\([^;]*min\([^;]*vw[^;]*vh[^;]*\)/);
    expect(heading).toMatch(/max-width:/);
  });

  it('keeps projector instructions at 22-24px and secondary text at least 18px', () => {
    const instructions = body('.bunker-v2-screen > main > p');
    const secondary = body(
      '.bunker-v2-screen > header p,\n.bunker-v2-screen > header span,\n.bunker-v2-screen > footer',
    );
    expect(instructions).toMatch(/font-size:\s*clamp\(22px,[^;]*24px\)/);
    expect(secondary).toMatch(/font-size:\s*clamp\(18px,[^;]*22px\)/);
  });

  it('uses warm paper cards with dark railway ink as the base mission surface', () => {
    const screen = body('.bunker-v2-screen');
    const card = body('.bunker-v2-screen article');
    expect(screen).toContain('--bunker-v2-ink: #3b1221');
    expect(screen).toContain('--bunker-v2-paper: #fffaf2');
    expect(screen).toContain('#f6e6d1');
    expect(card).toContain('background: #fffaf2');
    expect(card).toContain('color: var(--bunker-v2-ink)');
  });

  it('keeps mission content and wagon cards inside the remaining viewport height', () => {
    const mission = body('.bunker-v2-screen > main');
    const grid = body('.bunker-v2-screen .bunker-wagon-grid,\n.bunker-v2-screen .bunker-v2-groups');
    expect(mission).toMatch(/min-height:\s*0/);
    expect(mission).toMatch(/overflow:\s*hidden/);
    expect(grid).toMatch(/min-height:\s*0/);
    expect(grid).toMatch(/flex:\s*1/);
    expect(css).toContain('.bunker-v2-screen .bunker-wagon-grid[data-count="5"]');
  });

  it('loads the base projector layout before the contrast override', () => {
    const base = main.indexOf("./styles/bunker-v2-projector.css");
    const contrast = main.indexOf("./styles/bunker-projector-contrast.css");
    expect(base).toBeGreaterThan(-1);
    expect(contrast).toBeGreaterThan(base);
  });
});
