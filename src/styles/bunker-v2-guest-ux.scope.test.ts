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

describe('Bunker V2 guest mobile UX styles', () => {
  it('gives mission screens an explicit readable card layout instead of raw fieldsets', () => {
    expect(ruleBody('.bunker-v2-mission')).toMatch(/display:\s*grid/);
    expect(ruleBody('.bunker-v2-mission__questions')).toMatch(/display:\s*grid/);
    expect(ruleBody('.bunker-v2-mission__question label')).toMatch(/min-height:\s*52px/);
    expect(ruleBody('.bunker-v2-mission__question input')).toMatch(/width:\s*1\.35rem/);
  });

  it('makes selected protocols and persistent status visually explicit', () => {
    expect(ruleBody('.bunker-v2-protocol-grid button.is-selected')).toMatch(/border-color:/);
    expect(ruleBody('.bunker-v2-mission__answer-status')).toMatch(/border-left:/);
    expect(ruleBody('.bunker-player-dashboard__wagon-summary')).toMatch(/display:\s*grid/);
  });

  it('keeps the portalled M01 confirmation opaque without inherited shell variables', () => {
    const confirmation = ruleBody('.bunker-mission-one-player__confirmation');
    expect(confirmation).toContain('color: #eee9dd');
    expect(confirmation).toContain('background: #0d0d0c');
    const primary = ruleBody('.bunker-mission-one-player__confirmation .bunker-mission-one-player__primary');
    expect(primary).toContain('color: #0d0d0c');
    expect(primary).toContain('background: #eee9dd');
  });
});
