import { describe, expect, it } from 'vitest';
import { assertSafeE2ESupabaseTarget } from './environmentGuard';

describe('assertSafeE2ESupabaseTarget', () => {
  it('rejects the production Supabase project before E2E setup can mutate data', () => {
    expect(() => assertSafeE2ESupabaseTarget('https://vogcchocbpqqwhfnzzwy.supabase.co'))
      .toThrow(/production Supabase/i);
  });

  it('allows local Supabase used by the E2E workflow', () => {
    expect(() => assertSafeE2ESupabaseTarget('http://127.0.0.1:54321')).not.toThrow();
  });

  it('allows a non-production hosted Supabase project', () => {
    expect(() => assertSafeE2ESupabaseTarget('https://abcdefghijklmnopqrst.supabase.co')).not.toThrow();
  });
});
