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

    expect(factory).toHaveBeenCalledWith(
      'https://api.event.test',
      'public-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
        }),
      }),
    );
  });

  it('removes an opaque publishable key from Authorization while keeping it as apikey', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const factory = vi.fn((_url, _key, options) => options);

    const options = createBackendClient({
      VITE_BACKEND_URL: 'https://api.event.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_event-key',
    }, factory, request as typeof fetch);

    await options.global.fetch('https://api.event.test/rest/v1/rpc', {
      headers: {
        Authorization: 'Bearer sb_publishable_event-key',
        'x-client-info': 'wedding-test',
      },
    });

    const forwarded = request.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(forwarded.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('apikey')).toBe('sb_publishable_event-key');
    expect(headers.get('x-client-info')).toBe('wedding-test');
  });

  it('keeps a configured local anon key ahead of the production fallback key', () => {
    const factory = vi.fn().mockReturnValue({ rpc: vi.fn() });

    createBackendClient(applyBackendFallbacks({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'local-anon-key',
    }), factory);

    expect(factory).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'local-anon-key',
      expect.any(Object),
    );
  });
});
