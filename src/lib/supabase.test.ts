import { describe, expect, it, vi } from 'vitest';
import { applyBackendFallbacks, createBackendClient } from './supabase';

describe('createBackendClient', () => {
  it('passes the controlled backend URL and publishable key to the client factory', () => {
    const client = { rpc: vi.fn() };
    const factory = vi.fn().mockReturnValue(client);

    expect(createBackendClient({
      VITE_BACKEND_URL: 'https://api.event.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public-key',
    }, factory)).toBe(client);

    expect(factory).toHaveBeenCalledWith('https://api.event.test', 'public-key');
  });

  it('keeps a configured local anon key ahead of the production fallback key', () => {
    const factory = vi.fn().mockReturnValue({ rpc: vi.fn() });

    createBackendClient(applyBackendFallbacks({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'local-anon-key',
    }), factory);

    expect(factory).toHaveBeenCalledWith('http://127.0.0.1:54321', 'local-anon-key');
  });
});
