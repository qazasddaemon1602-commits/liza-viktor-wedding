// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };

function readStyle(name: string): string {
  return readFileSync(`${runtime.process.cwd()}/src/styles/${name}`, 'utf8').replace(/\r\n/g, '\n');
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches.length, `missing CSS rule for ${selector}`).toBeGreaterThan(0);
  return matches.map((match) => match[1]).join('\n');
}

describe('Bunker wedding theme', () => {
  const css = readStyle('bunker-wedding-theme.css');
  const main = readFileSync(`${runtime.process.cwd()}/src/main.tsx`, 'utf8');

  it('loads after accessibility and projector contrast so the shared celebration palette wins', () => {
    const accessibility = main.indexOf("./styles/bunker-accessibility.css");
    const projectorContrast = main.indexOf("./styles/bunker-projector-contrast.css");
    const weddingTheme = main.indexOf("./styles/bunker-wedding-theme.css");

    expect(weddingTheme).toBeGreaterThan(accessibility);
    expect(weddingTheme).toBeGreaterThan(projectorContrast);
  });

  it('replaces the guest shell black palette with warm wedding paper and burgundy ink', () => {
    const shell = ruleBody(css, '.bunker-player-shell');

    expect(shell).toContain('--bunker-player-black: #fff8ee');
    expect(shell).toContain('--bunker-player-graphite: #fffdf8');
    expect(shell).toContain('--bunker-player-ivory: #4b1728');
    expect(shell).toMatch(/background:\s*radial-gradient/);
  });

  it('keeps primary guest actions large, high-contrast and visibly interactive', () => {
    const actions = ruleBody(
      css,
      '.bunker-v2-mission__primary,\n.bunker-mission-one-player__primary,\n.bunker-mission-actions button,\n.bunker-player-ability-action button',
    );

    expect(actions).toMatch(/min-height:\s*56px/);
    expect(actions).toContain('background: #6f2941');
    expect(actions).toContain('color: #fffaf2');
  });

  it('gives player choices a persistent champagne selected state', () => {
    const selected = ruleBody(
      css,
      '.bunker-v2-mission__question label.is-selected,\n.bunker-v2-protocol-grid button.is-selected,\n.bunker-mission-one-player__members label.is-selected',
    );

    expect(selected).toContain('border-color: #b8863f');
    expect(selected).toContain('box-shadow: inset 5px 0 #b8863f');
  });

  it('uses a warm, celebratory projector palette without reducing contrast', () => {
    const screen = ruleBody(css, '.bunker-v2-screen');

    expect(screen).toContain('--bunker-v2-paper: #fff8ee');
    expect(screen).toContain('--bunker-v2-muted: #ead7d2');
    expect(screen).toMatch(/background:\s*radial-gradient/);
  });
});
