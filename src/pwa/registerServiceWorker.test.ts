import { describe, expect, it, vi } from 'vitest';
import { registerWeddingServiceWorker } from './registerServiceWorker';

describe('registerWeddingServiceWorker', () => {
  it('registers the wedding app service worker at root scope', async () => {
    const registration = { scope: 'https://wedding.example/' };
    const register = vi.fn().mockResolvedValue(registration);

    await expect(registerWeddingServiceWorker({ register })).resolves.toBe(registration);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('is a no-op when service workers are unavailable', async () => {
    await expect(registerWeddingServiceWorker(null)).resolves.toBeNull();
  });

  it('fails softly when registration itself is blocked by the browser', async () => {
    const register = vi.fn().mockRejectedValue(new Error('blocked'));

    await expect(registerWeddingServiceWorker({ register })).resolves.toBeNull();
  });
});
