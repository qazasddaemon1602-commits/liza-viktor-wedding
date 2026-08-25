import { describe, expect, it } from 'vitest';
import mainSource from '../main.tsx?raw';

describe('Bunker accessibility stylesheet order', () => {
  it('loads accessibility after mobile hardening and wedding theme so minimums win the cascade', () => {
    const mobile = mainSource.indexOf("./styles/mobile-hardening.css");
    const wedding = mainSource.indexOf("./styles/bunker-wedding-theme.css");
    const accessibility = mainSource.indexOf("./styles/bunker-accessibility.css");

    expect(mobile).toBeGreaterThanOrEqual(0);
    expect(accessibility).toBeGreaterThan(mobile);
    expect(accessibility).toBeGreaterThan(wedding);
  });
});
