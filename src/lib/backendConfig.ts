export type BackendEnvironment = Partial<Record<
  'VITE_BACKEND_URL' | 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_ANON_KEY',
  string
>>;

export type BackendConfig = {
  url: string;
  key: string;
};

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function resolveBackendConfig(env: BackendEnvironment): BackendConfig {
  const url = clean(env.VITE_BACKEND_URL) || clean(env.VITE_SUPABASE_URL);
  const key = clean(env.VITE_SUPABASE_PUBLISHABLE_KEY) || clean(env.VITE_SUPABASE_ANON_KEY);

  if (!url || !key) {
    throw new Error('Backend configuration is missing. Set the event backend URL and publishable key.');
  }

  return { url, key };
}
