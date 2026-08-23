// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${testRuntime.process.cwd()}/src/styles/bunker-player.css`, 'utf8');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches, `missing CSS rule for ${selector}`).not.toHaveLength(0);
  return matches.at(-1)?.[1] ?? '';
}

describe('Bunker phone mission action sizing', () => {
  it('provides an 18px body token and 52px targets in large-text mode', () => {
    expect(ruleBody('.bunker-player-dashboard[data-large-text="true"]')).toContain('--bunker-player-body-size: 1.125rem');
    expect(ruleBody('.bunker-player-dashboard[data-large-text="true"] button')).toContain('min-height: 52px');
    expect(ruleBody('.bunker-player-dashboard[data-large-text="true"] .bunker-mission-actions label:has(input[type="checkbox"])')).toContain('min-height: 52px');
    expect(ruleBody('.bunker-player-dashboard[data-large-text="true"] .bunker-mission-actions label:has(input[type="radio"])')).toContain('min-height: 52px');
  });

  it('routes mission instructions, choices and problem guidance through the body-size token', () => {
    expect(ruleBody('.bunker-mission-actions label > span')).toContain('font-size: var(--bunker-player-body-size)');
    expect(ruleBody('.bunker-global-action__choices label')).toContain('font-size: var(--bunker-player-body-size)');
    expect(ruleBody('.bunker-m03-problem-board p')).toContain('font-size: var(--bunker-player-body-size)');
    expect(ruleBody('.bunker-m03-problem-board span')).toContain('font-size: var(--bunker-player-body-size)');
    expect(ruleBody('.bunker-m03-problem-board strong')).toContain('font-size: var(--bunker-player-body-size)');
    expect(ruleBody('.bunker-m03-problem-board__control > span')).toContain('font-size: var(--bunker-player-body-size)');
    expect(ruleBody('.bunker-player-dashboard[data-large-text="true"] .bunker-mission-briefing__header strong')).toContain('font-size: var(--bunker-player-body-size)');
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
    expect(ruleBody('.bunker-m03-additional-items__choices label > span > small')).toContain('font-size: var(--bunker-player-body-size)');
  });
});
