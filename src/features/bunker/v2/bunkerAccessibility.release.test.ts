import { describe, expect, it } from 'vitest';
import bunkerPlayerCss from '../../../styles/bunker-player.css?raw';
import bunkerAccessibilityCss from '../../../styles/bunker-accessibility.css?raw';

function cssText(): string {
  return [bunkerPlayerCss, bunkerAccessibilityCss].join('\n');
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
