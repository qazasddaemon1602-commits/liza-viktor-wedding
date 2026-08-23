// @ts-expect-error Vitest executes this contract in Node; the client bundle omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${testRuntime.process.cwd()}/src/styles/screen-controls.css`, 'utf8');

describe('Projector narration control sizing', () => {
  it('keeps narration actions comfortably readable and at least 40px tall', () => {
    expect(css).toMatch(/\.screen-audio-control__narration,[\s\S]*?\.screen-audio-control__replay\s*\{[^}]*min-height:\s*2\.5rem/);
    expect(css).toMatch(/\.screen-audio-control__narration\s*\{[^}]*font-size:\s*0\.68rem/);
    expect(css).toMatch(/\.screen-audio-control__replay\s*\{[^}]*width:\s*2\.5rem/);
  });
});
