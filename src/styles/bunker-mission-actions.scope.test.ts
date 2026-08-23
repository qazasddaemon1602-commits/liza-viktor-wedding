// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${testRuntime.process.cwd()}/src/styles/bunker-player.css`, 'utf8');

describe('Bunker phone mission action sizing', () => {
  it('provides an 18px body token and 52px targets in large-text mode', () => {
    expect(css).toMatch(/\.bunker-player-dashboard\[data-large-text="true"\]\s*\{[^}]*--bunker-player-body-size:\s*1\.125rem/);
    expect(css).toMatch(/\.bunker-player-dashboard\[data-large-text="true"\][\s\S]*?\.bunker-player-dashboard__nav button[\s\S]*?min-height:\s*52px/);
    expect(css).toMatch(/\.bunker-player-dashboard\[data-large-text="true"\][\s\S]*?\.bunker-player-dashboard__large-text-toggle[\s\S]*?min-height:\s*52px/);
  });

  it('keeps mission inputs and buttons at least 48px tall', () => {
    expect(css).toMatch(/\.bunker-mission-actions[^}]*button[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.bunker-mission-actions[^}]*input[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.bunker-mission-actions[^}]*textarea[\s\S]*?min-height:\s*8rem/);
    expect(css).toMatch(/\.bunker-mission-actions[^}]*select[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.bunker-global-action__choices label[^}]*min-height:\s*48px/);
    expect(css).toMatch(/\.bunker-player-ability-action button[^}]*min-height:\s*48px/);
  });

  it('keeps phone navigation labels at a readable 16px minimum', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 760px)'));
    expect(mobile).toMatch(/\.bunker-player-dashboard__nav button\s*\{[^}]*font-size:\s*1rem/);
  });

  it('gives inventory icons a stable visual slot', () => {
    expect(css).toMatch(/\.bunker-inventory-card__icon\s*\{[^}]*width:\s*clamp\(4rem,[^;]*6rem\)[^}]*height:\s*clamp\(4rem,[^;]*6rem\)/);
  });

  it('keeps additional-item guidance readable in the normal phone mode', () => {
    expect(css).toMatch(/\.bunker-m03-additional-items__choices label > span > small\s*\{[^}]*font-size:\s*1rem/);
  });
});
