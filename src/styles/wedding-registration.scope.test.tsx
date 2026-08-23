import { render, screen } from '@testing-library/react';
// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const readStyle = (fileName: string) => readFileSync(
  `${testRuntime.process.cwd()}/src/styles/${fileName}`,
  'utf8',
);

const applicationStyles = [
  readStyle('globals.css'),
  readStyle('wedding-registration.css'),
].join('\n');

let stylesheet: HTMLStyleElement | null = null;

afterEach(() => {
  stylesheet?.remove();
  stylesheet = null;
});

function SharedControlFixture() {
  return (
    <>
      <section aria-label="Административная форма">
        <label className="registration-form">
          <span>Сообщение вагонам</span>
          <textarea aria-label="Сообщение вагонам" />
        </label>
        <button className="registration-submit" type="button">ОТПРАВИТЬ ВЫЗОВ</button>
        <button className="registration-secondary" type="button">ОТМЕНИТЬ</button>
      </section>

      <main className="registration-ticket-surface" aria-label="Билетная форма">
        <div className="registration-form">
          <label>
            <span>Имя</span>
            <input aria-label="Имя" />
          </label>
          <button className="registration-submit" type="button">ПОЛУЧИТЬ БИЛЕТ</button>
          <button className="registration-secondary" type="button">ВЕРНУТЬСЯ</button>
        </div>
      </main>
    </>
  );
}

describe('wedding registration stylesheet scope', () => {
  it('styles shared registration controls only inside a ticket surface', () => {
    stylesheet = document.createElement('style');
    stylesheet.textContent = applicationStyles;
    document.head.append(stylesheet);

    render(<SharedControlFixture />);

    const adminForm = screen.getByRole('region', { name: 'Административная форма' })
      .querySelector('.registration-form') as HTMLElement;
    const adminPrimary = screen.getByRole('button', { name: 'ОТПРАВИТЬ ВЫЗОВ' });
    const adminSecondary = screen.getByRole('button', { name: 'ОТМЕНИТЬ' });
    const ticketForm = screen.getByRole('main', { name: 'Билетная форма' })
      .querySelector('.registration-form') as HTMLElement;
    const ticketPrimary = screen.getByRole('button', { name: 'ПОЛУЧИТЬ БИЛЕТ' });
    const ticketSecondary = screen.getByRole('button', { name: 'ВЕРНУТЬСЯ' });

    expect(getComputedStyle(adminForm).display).toBe('grid');
    expect(getComputedStyle(adminForm).gridTemplateColumns).not.toBe('repeat(2, minmax(0, 1fr))');
    expect(getComputedStyle(adminPrimary).minHeight).toBe('60.8px');
    expect(getComputedStyle(adminSecondary).minHeight).toBe('51.2px');

    expect(getComputedStyle(ticketForm).display).toBe('grid');
    expect(getComputedStyle(ticketForm).gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(getComputedStyle(ticketPrimary).minHeight).toBe('48px');
    expect(getComputedStyle(ticketSecondary).minHeight).toBe('48px');
    expect(getComputedStyle(ticketPrimary).fontSize).toBe('16px');
    expect(getComputedStyle(ticketSecondary).fontSize).toBe('16px');

  });
});
