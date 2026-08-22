import { describe, expect, it } from 'vitest';
import mainSource from '../main.tsx?raw';

describe('Bunker accessibility stylesheet order', () => {
  it('loads accessibility after mobile hardening so minimum touch targets win', () => {
    const mobile = mainSource.indexOf("./styles/mobile-hardening.css");
    const accessibility = mainSource.indexOf("./styles/bunker-accessibility.css");

    expect(mobile).toBeGreaterThanOrEqual(0);
    expect(accessibility).toBeGreaterThan(mobile);
  });
});
