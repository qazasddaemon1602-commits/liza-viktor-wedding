import { describe, expect, it } from 'vitest';
import { resolveBackendConfig } from './backendConfig';

describe('resolveBackendConfig', () => {
  it('prefers a controlled backend URL over the default Supabase project URL', () => {
    expect(resolveBackendConfig({
      VITE_BACKEND_URL: 'https://api.event.test',
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
    })).toEqual({
      url: 'https://api.event.test',
      key: 'publishable-key',
    });
  });

  it('falls back to the Supabase URL and legacy anon key when needed', () => {
    expect(resolveBackendConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })).toEqual({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
  });

  it('fails explicitly when runtime backend configuration is missing', () => {
    expect(() => resolveBackendConfig({})).toThrow(/backend configuration/i);
  });
});
