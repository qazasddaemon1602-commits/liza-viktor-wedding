// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${testRuntime.process.cwd()}/src/styles/quiz.css`, 'utf8');

describe('quiz reaction styling scope', () => {
  it('keeps static editorial styling without a second projector entrance choreography', () => {
    expect(css).not.toContain('.quiz-screen-transition-curtain');
    expect(css).not.toContain('quiz-paper-reveal');
    expect(css).not.toContain('quiz-results-arrive');
  });
});
