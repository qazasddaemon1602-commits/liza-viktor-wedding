// @ts-expect-error Vitest runs this contract test in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const testRuntime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const css = readFileSync(`${testRuntime.process.cwd()}/src/styles/admin-bunker.css`, 'utf8');

describe('admin Bunker host runbook layout', () => {
  it('wraps the timeline and script without forcing horizontal overflow', () => {
    expect(css).toMatch(/\.admin-bunker-runbook\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.admin-bunker-runbook__timeline\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*10rem\),\s*1fr\)\)/);
    expect(css).toMatch(/\.admin-bunker-runbook__script\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.admin-bunker-runbook__script\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('keeps runbook labels at a readable sixteen-pixel minimum', () => {
    expect(css).toMatch(/\.admin-bunker-runbook__timeline span,[\s\S]*?\.admin-bunker-runbook__summary span\s*\{[^}]*font-size:\s*1rem/);
    expect(css).toMatch(/\.admin-bunker-runbook__script article h4\s*\{[^}]*font-size:\s*1rem/);
    expect(css).toMatch(/\.admin-bunker-runbook__guard\s*\{[^}]*font-size:\s*1rem/);
  });
});
