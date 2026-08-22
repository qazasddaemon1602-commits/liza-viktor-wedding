import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

describe('Bunker human-readable copy release guard', () => {
  it('does not show raw mission numbers in the owner stage controls', () => {
    const control = source('./AdminBunkerControl.tsx');
    expect(control).not.toMatch(/МИССИЯ\s+0[1-6]/);
    expect(control).not.toMatch(/НАЧАТЬ\s+МИССИЮ\s+0[1-6]/);
  });

  it('does not reintroduce English RESET into the rehearsal panel', () => {
    const rehearsal = source('./BunkerTestPanel.tsx');
    expect(rehearsal).not.toMatch(/\bRESET\b/);
  });
});
