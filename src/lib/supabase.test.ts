import { describe, expect, it, vi } from 'vitest';
import { createBackendClient } from './supabase';

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
});
