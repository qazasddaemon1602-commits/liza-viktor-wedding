import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveBackendConfig, type BackendEnvironment } from './backendConfig';

export type BackendClientOptions = {
  global: { fetch: typeof fetch };
  auth: {
    storage: Storage | undefined;
    persistSession: true;
    autoRefreshToken: true;
  };
};

function isOpaqueSupabaseKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

export function createSupabaseFetch(
  supabaseKey: string,
  request: typeof fetch = globalThis.fetch,
): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isOpaqueSupabaseKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return request(input, { ...init, headers });
  };
}

export function createBackendClient<T>(
  env: BackendEnvironment,
  factory: (url: string, key: string, options: BackendClientOptions) => T,
  request: typeof fetch = globalThis.fetch,
): T {
  const { url, key } = resolveBackendConfig(env);
  return factory(url, key, {
    global: {
      fetch: createSupabaseFetch(key, request),
    },
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let singleton: SupabaseClient | null = null;

// Public (publishable) backend values, used as a build-time fallback when the
// hosting build does not expose the VITE_* variables. Both are safe to ship in
// the browser bundle; RLS protects the data.
const FALLBACK_BACKEND_URL = 'https://vogcchocbpqqwhfnzzwy.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_5qVXua51ZEO5-WFq5UUOZg_2CaPSswA';

export function applyBackendFallbacks(env: BackendEnvironment): BackendEnvironment {
  const hasPublishableKey = Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim());
  const hasAnonKey = Boolean(env.VITE_SUPABASE_ANON_KEY?.trim());

  return {
    ...env,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL?.trim() || FALLBACK_BACKEND_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: hasPublishableKey
      ? env.VITE_SUPABASE_PUBLISHABLE_KEY
      : hasAnonKey
        ? undefined
        : FALLBACK_PUBLISHABLE_KEY,
  };
}

export function getSupabaseClient(): SupabaseClient {
  if (singleton) return singleton;

  singleton = createBackendClient(
    applyBackendFallbacks({
      VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    }),
    (url, key, options) => createClient(url, key, options),
  );

  return singleton;
}

