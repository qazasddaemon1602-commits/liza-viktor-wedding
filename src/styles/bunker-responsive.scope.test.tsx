import { render, screen } from '@testing-library/react';
// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const readStyle = (fileName: string) => readFileSync(
  `${testRuntime.process.cwd()}/src/styles/${fileName}`,
  'utf8',
);

const questStyle = readStyle('bunker-quest.css');
const playerStyle = readStyle('bunker-player.css');
const emergencyStyle = readStyle('bunker.css');
const mobileHardeningStyle = readStyle('mobile-hardening.css');

let stylesheet: HTMLStyleElement | null = null;

beforeEach(() => {
  stylesheet = document.createElement('style');
  stylesheet.textContent = [questStyle, playerStyle, mobileHardeningStyle].join('\n');
  document.head.append(stylesheet);
});

afterEach(() => {
  stylesheet?.remove();
  stylesheet = null;
});

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  expect(matches, `missing CSS rule for ${selector}`).not.toHaveLength(0);
  return matches.at(-1)?.[1] ?? '';
}

function ruleForDeclaration(css: string, declaration: string): { selector: string; body: string } {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const rule = rules.find(([, selector, body]) => (
    selector.includes('.bunker-mission-actions') && body.includes(declaration)
  ));
  expect(rule, `missing CSS rule containing ${declaration}`).toBeDefined();
  return { selector: rule?.[1].trim() ?? '', body: rule?.[2] ?? '' };
}

describe('Bunker responsive layout contract', () => {
  it('keeps the active TV scene inside one landscape viewport', () => {
    const headerTitle = ruleBody(questStyle, '.bunker-quest-scene__header h1');

    expect(questStyle).toMatch(
      /\.bunker-quest-scene\s*\{[^}]*height:\s*100(?:svh|dvh)[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/,
    );
    expect(headerTitle).toMatch(/font-size:\s*clamp\([^;]*min\([^;]*vh[^;]*\)[^;]*\)/);
    expect(questStyle).toMatch(/font-size:\s*clamp\(30px,\s*min\(4\.2vw,\s*7\.5vh\),\s*82px\)/);
    expect(headerTitle).not.toMatch(/line-clamp|text-overflow|overflow:\s*hidden/);
    expect(questStyle).toMatch(/data-headline-density="long"/);
    expect(questStyle).toMatch(
      /\.bunker-quest-scene__mission,\s*\.bunker-quest-scene__final\s*\{[^}]*display:\s*grid[^}]*align-content:\s*center/,
    );
    expect(questStyle).toMatch(/@media\s*\(max-height:\s*820px\)[^{]*\{/);
    expect(questStyle).toMatch(
      /\.bunker-quest-scene__body\s*\{[^}]*min-height:\s*0[^}]*grid-template-columns:\s*minmax\([^}]*overflow:\s*(?:auto|hidden)/,
    );
  });

  it('keeps emergency title and timer fluid in both width and height', () => {
    const title = ruleBody(emergencyStyle, '.bunker-emergency__content h1');
    const timer = ruleBody(emergencyStyle, '.bunker-emergency__timer-block strong');

    expect(title).toMatch(/font-size:\s*clamp\([^;]*min\([^;]*vh[^;]*\)[^;]*\)/);
    expect(timer).toMatch(/font-size:\s*clamp\([^;]*min\([^;]*vh[^;]*\)[^;]*\)/);
    expect(emergencyStyle).toMatch(/font-size:\s*clamp\([^;]*min\([^;]*vh[^;]*\),\s*16rem\)/);
    expect(emergencyStyle).toMatch(/font-size:\s*clamp\([^;]*min\([^;]*vh[^;]*\),\s*12rem\)/);
  });

  it('reserves the emergency header corner for the fixed audio control', () => {
    const emergency = ruleBody(emergencyStyle, '.bunker-emergency');
    const header = ruleBody(emergencyStyle, '.bunker-emergency__header');

    expect(emergency).toContain('--bunker-audio-safe-width:');
    expect(header).toMatch(/padding-right:\s*var\(--bunker-audio-safe-width\)/);
  });

  it('reserves one-row primary navigation with an overflow disclosure and keeps its controls at least 48px tall', () => {
    expect(playerStyle).toContain('--bunker-player-mobile-nav-height: 4.5rem');
    expect(playerStyle).toMatch(/padding:[^;]*var\(--bunker-player-mobile-nav-height\)/);
    const mobile = playerStyle.slice(playerStyle.indexOf('@media (max-width: 760px)'));
    expect(mobile).toMatch(/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*minmax\(3\.8rem,\s*0\.8fr\)/);
    expect(mobile).toMatch(/\.bunker-player-dashboard__nav-overflow-toggle\s*\{[^}]*display:\s*block/);
    render(<nav className="bunker-player-dashboard__nav"><button type="button">Архив</button></nav>);
    expect(getComputedStyle(screen.getByRole('button', { name: 'Архив' })).minHeight).toBe('48px');
  });

  it('extends shell clearance when the dashboard enables large text', () => {
    const largeShell = ruleBody(playerStyle, '.bunker-player-shell:has(.bunker-player-dashboard[data-large-text="true"])');
    expect(largeShell).toContain('--bunker-player-mobile-nav-height: 5.625rem');
  });

  it('keeps the four-line large-text task tab inside the compact navigation row', () => {
    const largeShell = ruleBody(playerStyle, '.bunker-player-shell:has(.bunker-player-dashboard[data-large-text="true"])');
    const largeButton = ruleBody(
      playerStyle,
      '.bunker-player-dashboard[data-large-text="true"] .bunker-player-dashboard__nav button',
    );

    // At 320px, "ТЕКУЩЕЕ ЗАДАНИЕ" can wrap to four 18px lines. With the
    // 1.05 line-height, 0.35rem block padding and borders it needs 88.8px.
    expect(largeShell).toContain('--bunker-player-mobile-nav-height: 5.625rem');
    expect(largeButton).toContain('height: 100%');
    expect(largeButton).toContain('max-height: 100%');
    expect(largeButton).toContain('box-sizing: border-box');
  });

  it('reserves fixed-navigation clearance for the actual M03, M04, and fallback action DOM', () => {
    const declaration = 'scroll-margin-block-end: calc(var(--bunker-player-mobile-nav-height) + env(safe-area-inset-bottom) + 0.75rem)';
    const actionRule = ruleForDeclaration(playerStyle, declaration);

    render(
      <main className="bunker-player-dashboard">
        <section className="bunker-mission-actions">
          <div className="bunker-global-action bunker-global-action--selection">
            <button data-testid="m03-submit" type="button">Применить запас</button>
          </div>
          <div className="bunker-global-action bunker-m04-exchange">
            <button data-testid="m04-submit" type="button">Отправить сообщение</button>
          </div>
          <form className="bunker-mission-actions__form">
            <button data-testid="final-submit" type="submit">Подтвердить</button>
          </form>
          <div className="bunker-mission-actions__answer">
            <button data-testid="answer-submit" type="button">Ответить</button>
          </div>
          <div className="bunker-mission-actions__options">
            <button data-testid="option-submit" type="button">Выбрать</button>
          </div>
        </section>
      </main>,
    );

    expect(actionRule.body).toContain(declaration);
    for (const testId of ['m03-submit', 'm04-submit', 'final-submit', 'answer-submit', 'option-submit']) {
      expect(screen.getByTestId(testId).matches(actionRule.selector), `${testId} must match ${actionRule.selector}`).toBe(true);
    }
  });

  it('lets M03 copy and controls reflow inside a narrow large-text card', () => {
    const content = ruleBody(playerStyle, '.bunker-m03-problem-board li > div');
    const copy = ruleBody(
      playerStyle,
      '.bunker-m03-problem-board p,\n.bunker-m03-problem-board h4,\n.bunker-m03-problem-board span,\n.bunker-m03-problem-board strong',
    );
    const control = ruleBody(playerStyle, '.bunker-m03-problem-board__control');

    expect(content).toContain('min-width: 0');
    expect(copy).toContain('min-width: 0');
    expect(copy).toContain('overflow-wrap: anywhere');
    expect(control).toContain('min-width: 0');
  });

  it('keeps guest quest controls at least 48px tall after the final mobile cascade', () => {
    render(<div className="guest-bunker-options"><button type="button">Ответить</button></div>);
    expect(getComputedStyle(screen.getByRole('button', { name: 'Ответить' })).minHeight).toBe('48px');
  });

  it('keeps admin quest controls at least 48px tall after the final mobile cascade', () => {
    render(<div className="admin-bunker-quest"><button type="button">Продолжить</button></div>);
    expect(getComputedStyle(screen.getByRole('button', { name: 'Продолжить' })).minHeight).toBe('48px');
  });

  it('keeps dashboard reading copy at a 16px baseline', () => {
    const dashboard = ruleBody(playerStyle, '.bunker-player-dashboard');
    expect(dashboard).toContain('--bunker-player-body-size: 1rem');
    expect(playerStyle).toMatch(
      /\.bunker-player-dashboard__content p,\s*\.bunker-player-dashboard__content dd\s*\{[^}]*font-size:\s*var\(--bunker-player-body-size\)/,
    );
  });

  it('lays out the mission briefing as readable editorial cards instead of raw metadata', () => {
    const briefing = ruleBody(playerStyle, '.bunker-mission-briefing');
    const item = ruleBody(playerStyle, '.bunker-mission-briefing li[data-item-key]');

    expect(briefing).toMatch(/display:\s*grid/);
    expect(briefing).toMatch(/gap:\s*(?:1rem|16px)/);
    expect(item).toMatch(/min-height:\s*(?:64px|4rem)/);
    expect(playerStyle).toMatch(/\.bunker-mission-briefing__header h2\s*\{[^}]*font-size:\s*clamp\(/);
  });

  it('keeps TV mission artwork uncropped and its central copy projector-readable', () => {
    const artwork = ruleBody(questStyle, '.bunker-quest-scene__story-artwork');
    const headline = ruleBody(questStyle, '.bunker-quest-scene__story strong');
    const instruction = ruleBody(questStyle, '.bunker-quest-scene__story p');

    expect(artwork).toMatch(/aspect-ratio:\s*4\s*\/\s*3/);
    expect(headline).toMatch(/font:[^;]*clamp\(20px,/);
    expect(instruction).toMatch(/font(?:-size)?:[^;]*clamp\(18px,/);
  });

  it('keeps TV metadata and phone microcopy readable for older guests', () => {
    expect(playerStyle).toMatch(
      /\.bunker-player-dashboard__index,[^{]*\.bunker-player-dashboard__primary-action\s*\{[^}]*font-size:\s*(?:1rem|16px)/,
    );
    expect(playerStyle).toMatch(
      /\.bunker-mission-briefing__header p,[^{]*\.bunker-mission-briefing article h3\s*\{[^}]*font-size:\s*var\(--bunker-player-body-size\)/,
    );
    expect(questStyle).toMatch(
      /\.bunker-quest-scene__header p,[^{]*\.bunker-quest-scene footer\s*\{[^}]*font:\s*600\s+clamp\(16px,/,
    );
    expect(questStyle).toMatch(
      /\.bunker-quest-scene__teams article > span,[^{]*\.bunker-quest-scene__teams article > i\s*\{[^}]*font:\s*600\s+clamp\(16px,/,
    );
  });
});
