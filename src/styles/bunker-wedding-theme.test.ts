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
  const transitionCss = [
    readStyle('bunker.css'),
    readStyle('bunker-v2-projector.css'),
    readStyle('bunker-projector-contrast.css'),
    css,
  ].join('\n');
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

    expect(screen).toContain('--bunker-v2-paper: #fffaf2');
    expect(screen).toContain('--bunker-v2-ink: #3b1221');
    expect(screen).toContain('--bunker-v2-muted: #684452');
    expect(screen).toMatch(/background:\s*radial-gradient/);
  });

  it('uses a 600ms warm crossfade and removes emergency blackout styling', () => {
    const crossfade = ruleBody(css, '.bunker-emergency__warm-crossfade');
    const title = ruleBody(css, '.bunker-emergency__title-crossfade');
    expect(crossfade).toContain('animation: bunker-warm-crossfade 600ms ease-out both');
    expect(crossfade).toContain('background: #f3d9ad');
    expect(title).toContain('animation: bunker-title-crossfade 600ms ease-out both');
    expect(transitionCss).not.toContain('.bunker-emergency__blackout');
    expect(transitionCss).not.toContain('.bunker-emergency__sync-tear');
    expect(transitionCss).not.toContain('@keyframes bunker-blackout');
    expect(transitionCss).not.toContain('@keyframes bunker-sync-tear');
  });

  it('makes Viktor a 36vw natural-colour image without face cropping', () => {
    const frame = ruleBody(css, '.bunker-emergency__route-story');
    const portrait = ruleBody(css, '.bunker-emergency__route-story img');
    expect(frame).toContain('width: 36vw');
    expect(frame).not.toMatch(/max-width:\s*44rem/);
    expect(portrait).toContain('object-fit: contain');
    expect(portrait).toContain('object-position: center');
    expect(portrait).toContain('filter: none');
  });

  it('keeps Liza warm, natural and uncropped on the projector', () => {
    const reveal = ruleBody(css, '.bunker-liza-reveal--screen');
    const portrait = ruleBody(css, '.bunker-liza-reveal--screen .bunker-liza-reveal__portrait img');
    expect(reveal).toContain('background-color: #f6e6d1');
    expect(portrait).toContain('object-fit: contain');
    expect(portrait).toContain('object-position: center');
    expect(portrait).toContain('filter: none');
  });

  it('keeps finale metrics readable and fills epilogue side space without cropping the couple', () => {
    const metrics = ruleBody(
      css,
      '.bunker-v2-results .bunker-v2-results__grid article strong,\n.bunker-v2-results .bunker-v2-results__grid article span,\n.bunker-v2-results .bunker-v2-results__grid article small',
    );
    const backdrop = ruleBody(
      css,
      '.bunker-v2-results-player .bunker-results-epilogue picture::before,\n.bunker-v2-results .bunker-results-epilogue picture::before',
    );

    expect(metrics).toContain('color: #4b1728');
    expect(metrics).toContain('font-size: 18px');
    expect(metrics).toContain('text-shadow: none');
    expect(backdrop).toContain("url('/images/bunker/story/couple-epilogue.webp')");
    expect(backdrop).toContain('filter: blur(18px)');
    const portrait = ruleBody(
      css,
      '.bunker-v2-results-player .bunker-results-epilogue picture img,\n.bunker-v2-results .bunker-results-epilogue picture img',
    );
    expect(portrait).toContain('object-fit: contain');
    const epilogueLabel = ruleBody(css, '.bunker-v2-results .bunker-results-epilogue span');
    expect(epilogueLabel).toContain('font-size: 18px');
  });
});
