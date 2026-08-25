import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs this CSS contract in Node; the browser app omits Node types.
import { readFileSync } from 'node:fs';
import mainSource from '../main.tsx?raw';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const bunkerStyleFiles = new Set([
  'bunker.css',
  'bunker-player.css',
  'bunker-quest.css',
  'bunker-v2-projector.css',
  'mobile-hardening.css',
  'bunker-projector-contrast.css',
  'bunker-wedding-theme.css',
  'bunker-accessibility.css',
]);

const orderedBunkerCss = [...mainSource.matchAll(/import ['"]\.\/styles\/([^'"]+\.css)['"];?/g)]
  .map((match) => match[1])
  .filter((fileName): fileName is string => Boolean(fileName && bunkerStyleFiles.has(fileName)))
  .map((fileName) => readFileSync(`${runtime.process.cwd()}/src/styles/${fileName}`, 'utf8'))
  .join('\n');

function withFinalCascade(markup: string, assertion: (host: HTMLElement) => void) {
  const style = document.createElement('style');
  const host = document.createElement('div');
  style.textContent = orderedBunkerCss;
  host.innerHTML = markup;
  document.head.append(style);
  document.body.append(host);
  try {
    assertion(host);
  } finally {
    host.remove();
    style.remove();
  }
}

describe('Bunker accessibility stylesheet order', () => {
  it('loads accessibility after mobile hardening and wedding theme so minimums win the cascade', () => {
    const mobile = mainSource.indexOf("./styles/mobile-hardening.css");
    const wedding = mainSource.indexOf("./styles/bunker-wedding-theme.css");
    const accessibility = mainSource.indexOf("./styles/bunker-accessibility.css");

    expect(mobile).toBeGreaterThanOrEqual(0);
    expect(accessibility).toBeGreaterThan(mobile);
    expect(accessibility).toBeGreaterThan(wedding);
  });

  it('resolves warm results and finale surfaces with burgundy contrast in the imported cascade', () => {
    withFinalCascade(`
      <section class="bunker-v2-results">
        <div class="bunker-v2-results__grid"><article><strong>ИТОГ</strong></article></div>
      </section>
      <section class="bunker-v2-final-screen">
        <main class="bunker-v2-final-screen__content">
          <section class="bunker-v2-final-screen__status"><strong>ПРОГРЕСС</strong></section>
        </main>
      </section>
    `, (host) => {
      const results = host.querySelector<HTMLElement>('.bunker-v2-results');
      const resultCard = host.querySelector<HTMLElement>('.bunker-v2-results__grid article');
      const resultText = host.querySelector<HTMLElement>('.bunker-v2-results__grid strong');
      const finalStatus = host.querySelector<HTMLElement>('.bunker-v2-final-screen__status');

      expect(results).not.toBeNull();
      expect(resultCard).not.toBeNull();
      expect(resultText).not.toBeNull();
      expect(finalStatus).not.toBeNull();
      expect(getComputedStyle(results!).backgroundColor).toBe('rgb(255, 250, 242)');
      expect(getComputedStyle(results!).color).toBe('rgb(59, 18, 33)');
      expect(getComputedStyle(resultCard!).backgroundColor).toBe('rgb(255, 248, 238)');
      expect(getComputedStyle(resultText!).color).toBe('rgb(75, 23, 40)');
      expect(getComputedStyle(finalStatus!).backgroundColor).toBe('rgba(255, 250, 242, 0.94)');
    });
  });

  it('resolves generic, primary, and ability V2 buttons to at least 56px', () => {
    withFinalCascade(`
      <section class="bunker-v2-mission">
        <button type="button">ОБЫЧНАЯ КНОПКА</button>
        <button class="bunker-v2-mission__primary" type="button">ГЛАВНОЕ ДЕЙСТВИЕ</button>
        <aside class="bunker-v2-mission__ability"><button type="button">СПОСОБНОСТЬ</button></aside>
      </section>
    `, (host) => {
      const heights = [...host.querySelectorAll<HTMLButtonElement>('.bunker-v2-mission button')]
        .map((button) => Number.parseFloat(getComputedStyle(button).minHeight));

      expect(heights).toHaveLength(3);
      expect(heights.every((height) => height >= 56)).toBe(true);
    });
  });

  it('keeps generic, primary, and ability V2 buttons at 56px inside the real large-text dashboard', () => {
    withFinalCascade(`
      <main class="bunker-player-dashboard" data-large-text="true">
        <section class="bunker-v2-mission">
          <button type="button">ОБЫЧНАЯ КНОПКА</button>
          <button class="bunker-v2-mission__primary" type="button">ГЛАВНОЕ ДЕЙСТВИЕ</button>
          <aside class="bunker-v2-mission__ability"><button type="button">СПОСОБНОСТЬ</button></aside>
        </section>
      </main>
    `, (host) => {
      const heights = [...host.querySelectorAll<HTMLButtonElement>('.bunker-v2-mission button')]
        .map((button) => Number.parseFloat(getComputedStyle(button).minHeight));

      expect(heights).toEqual([56, 56, 56]);
    });
  });
});
