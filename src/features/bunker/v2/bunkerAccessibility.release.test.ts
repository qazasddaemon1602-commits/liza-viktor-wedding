import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs this release guard in Node; the browser app omits Node types.
import { readFileSync } from 'node:fs';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const readStyle = (fileName: string) => readFileSync(
  `${testRuntime.process.cwd()}/src/styles/${fileName}`,
  'utf8',
);

function cssText(): string {
  return [readStyle('bunker-player.css'), readStyle('bunker-accessibility.css')].join('\n');
}

describe('Bunker mobile accessibility release guard', () => {
  it('keeps all game buttons and final inputs large enough for an older guest on a phone', () => {
    const css = cssText();
    expect(css).toMatch(/\.bunker-v2-mission\s+(?:button|input|select|textarea)[^{]*\{[^}]*min-height:\s*(?:52px|3\.25rem)/s);
    expect(css).toMatch(/\.bunker-v2-final-terminal\s+input[^{]*\{[^}]*min-height:\s*(?:5[2-9]px|3\.25rem)/s);
    expect(css).toMatch(/\.bunker-player-dashboard__nav button[^{]*\{[^}]*min-height:\s*(?:5[2-9]px|3\.25rem)/s);
  });

  it('keeps readable mobile navigation text instead of tiny technical labels', () => {
    const css = cssText();
    const mobile = css.match(/@media \(max-width: 760px\)[\s\S]*?@media \(max-width: 360px\)/g)?.at(-1) ?? '';
    expect(mobile).toMatch(/\.bunker-player-dashboard__nav button[^{]*\{[^}]*font-size:\s*(?:0\.75rem|0\.8rem|0\.85rem|1rem)/s);
  });
});
