export const PRODUCTION_SUPABASE_PROJECT_REF = 'vogcchocbpqqwhfnzzwy';

function hostedSupabaseProjectRef(value: string): string | null {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (!hostname.endsWith('.supabase.co')) return null;
    const [projectRef] = hostname.split('.');
    return projectRef || null;
  } catch {
    return null;
  }
}

export function assertSafeE2ESupabaseTarget(url: string): void {
  const projectRef = hostedSupabaseProjectRef(url);
  if (projectRef === PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(
      `E2E refused to run against production Supabase project ${PRODUCTION_SUPABASE_PROJECT_REF}`,
    );
  }
}
