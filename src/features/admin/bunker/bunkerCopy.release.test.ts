import { describe, expect, it } from 'vitest';
import adminBunkerControlSource from './AdminBunkerControl.tsx?raw';
import bunkerTestPanelSource from './BunkerTestPanel.tsx?raw';

describe('Bunker human-readable copy release guard', () => {
  it('does not show raw mission numbers in the owner stage controls', () => {
    expect(adminBunkerControlSource).not.toMatch(/МИССИЯ\s+0[1-6]/);
    expect(adminBunkerControlSource).not.toMatch(/НАЧАТЬ\s+МИССИЮ\s+0[1-6]/);
  });

  it('does not reintroduce English RESET into the rehearsal panel', () => {
    expect(bunkerTestPanelSource).not.toMatch(/\bRESET\b/);
  });
});
