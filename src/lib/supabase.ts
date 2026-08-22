import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveBackendConfig, type BackendEnvironment } from './backendConfig';

export function createBackendClient<T>(
  env: BackendEnvironment,
  factory: (url: string, key: string) => T,
): T {
  const { url, key } = resolveBackendConfig(env);
  return factory(url, key);
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
    (url, key) => createClient(url, key),
  );

  return singleton;
}

