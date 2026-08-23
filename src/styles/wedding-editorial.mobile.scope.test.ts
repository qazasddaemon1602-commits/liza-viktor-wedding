// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & {
  process: { cwd: () => string };
};

const css = readFileSync(
  `${testRuntime.process.cwd()}/src/styles/wedding-editorial.css`,
  'utf8',
).replace(/\r\n/g, '\n');

describe('wedding editorial mobile overflow contract', () => {
  it('keeps vertical idle-screen scrolling while clipping decorative horizontal overflow', () => {
    const mobileStart = css.indexOf('@media (max-width: 900px)');
    const mobileEnd = css.indexOf('@media (max-width: 480px)', mobileStart);
    expect(mobileStart).toBeGreaterThanOrEqual(0);
    expect(mobileEnd).toBeGreaterThan(mobileStart);

    const mobileRules = css.slice(mobileStart, mobileEnd);
    expect(mobileRules).toMatch(
      /\.event-screen--idle\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/,
    );
    expect(mobileRules).not.toMatch(/\.event-screen--idle\s*\{[^}]*overflow:\s*auto;/);
  });
});
