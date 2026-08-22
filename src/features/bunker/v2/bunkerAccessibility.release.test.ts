import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function cssText(): string {
  const path = fileURLToPath(new URL('../../../styles/bunker-player.css', import.meta.url));
  return readFileSync(path, 'utf8');
}

describe('Bunker mobile accessibility release guard', () => {
  it('keeps all game buttons and final inputs large enough for an older guest on a phone', () => {
    const css = cssText();
    expect(css).toMatch(/\.bunker-v2-mission\s+(?:button|input|select|textarea)[^{]*\{[^}]*min-height:\s*(?:52px|3\.25rem)/s);
    expect(css).toMatch(/\.bunker-v2-final-terminal\s+input[^{]*\{[^}]*min-height:\s*(?:52px|3\.25rem)/s);
    expect(css).toMatch(/\.bunker-player-dashboard__nav button[^{]*\{[^}]*min-height:\s*(?:52px|3\.25rem)/s);
  });

  it('keeps readable mobile navigation text instead of tiny technical labels', () => {
    const css = cssText();
    const mobile = css.match(/@media \(max-width: 760px\)[\s\S]*?@media \(max-width: 360px\)/)?.[0] ?? '';
    expect(mobile).toMatch(/\.bunker-player-dashboard__nav button[^{]*\{[^}]*font-size:\s*(?:0\.75rem|0\.8rem|0\.85rem|1rem)/s);
  });
});
