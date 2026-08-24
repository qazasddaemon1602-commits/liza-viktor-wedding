import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs this CSS contract in Node; the browser app omits Node types.
import { readFileSync } from 'node:fs';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const readStyle = (fileName: string) => readFileSync(
  `${testRuntime.process.cwd()}/src/styles/${fileName}`,
  'utf8',
).replace(/\r\n/g, '\n');

const css = [
  readStyle('bunker-accessibility.css'),
  readStyle('bunker-player.css'),
  readStyle('bunker-quest.css'),
].join('\n');

describe('Bunker guided-player accessibility contract', () => {
  it('keeps mobile reading copy and mission controls at the accessible baseline', () => {
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.bunker-player-dashboard[^\{]*\{[^}]*--bunker-player-body-size:\s*18px/s);
    expect(css).toMatch(/\.bunker-player-dashboard__primary-action[^{]*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.bunker-v2-mission input\[type="radio"\][^{]*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
  });

  it('covers the legacy briefing and Mission 01 action controls rather than only generic targets', () => {
    expect(css).toMatch(/\.bunker-mission-briefing article p,[\s\S]*?\.bunker-mission-briefing li\[data-item-key\] span[^{]*\{[^}]*font-size:\s*18px/s);
    expect(css).toMatch(/\.bunker-mission-one-player__primary,[\s\S]*?\.bunker-mission-one-player__secondary[^{]*\{[^}]*font-size:\s*20px/s);
  });

  it('keeps the phone navigation within 58–64px and labels at least 16px', () => {
    const mobile = css.match(/@media \(max-width: 760px\)[\s\S]*?(?=@media|$)/g)?.join('\n') ?? '';
    expect(mobile).toMatch(/--bunker-player-mobile-nav-height:\s*(?:58px|59px|60px|61px|62px|63px|64px)/);
    expect(mobile).toMatch(/\.bunker-player-dashboard__nav button\s*\{[^}]*font-size:\s*(?:1rem|16px)/s);
  });

  it('provides visible focus and motion fallbacks for guided player surfaces', () => {
    expect(css).toMatch(/\.bunker-player-dashboard__guided-mission\s+:focus-visible[^{]*\{[^}]*outline:\s*3px/s);
    expect(css).toMatch(/\.bunker-player-dashboard__nav button:focus-visible[^{]*\{[^}]*outline:\s*3px\s+solid\s+#6f2941/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.bunker-player-dashboard__guided-mission \*/s);
  });
});
