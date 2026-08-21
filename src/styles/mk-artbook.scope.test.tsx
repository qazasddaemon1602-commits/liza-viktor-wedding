import { render, screen } from '@testing-library/react';
// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const tournamentStyle = readFileSync(
  `${testRuntime.process.cwd()}/src/styles/mk-artbook.css`,
  'utf8',
);

let stylesheet: HTMLStyleElement | null = null;

afterEach(() => {
  stylesheet?.remove();
  stylesheet = null;
});

describe('tournament artbook theme scope', () => {
  it('provides the same tokens to dedicated and shared projector roots', () => {
    stylesheet = document.createElement('style');
    stylesheet.textContent = tournamentStyle;
    document.head.append(stylesheet);

    render(
      <>
        <main className="mk-screen-page" aria-label="Отдельный экран турнира" />
        <main className="screen-page screen-page--mk" aria-label="Общий экран турнира" />
        <main className="mk-page" aria-label="Гостевая арена">
          <section className="mk-public-bracket" aria-label="Панель сетки" />
        </main>
      </>,
    );

    const dedicated = getComputedStyle(screen.getByRole('main', { name: 'Отдельный экран турнира' }));
    const shared = getComputedStyle(screen.getByRole('main', { name: 'Общий экран турнира' }));

    expect(dedicated.getPropertyValue('--mk-gold-bright').trim()).toBe('#d9c58d');
    expect(shared.getPropertyValue('--mk-gold-bright').trim()).toBe('#d9c58d');
    expect(shared.getPropertyValue('--mk-panel').trim()).toBe('#11110f');
    expect(getComputedStyle(screen.getByRole('main', { name: 'Гостевая арена' })).backgroundImage)
      .toContain('/images/tournament/stone-texture.png');
    expect(getComputedStyle(screen.getByRole('region', { name: 'Панель сетки' })).backgroundImage)
      .toContain('/images/tournament/stone-texture.png');
  });
});
