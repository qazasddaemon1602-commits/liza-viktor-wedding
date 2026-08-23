// @ts-expect-error Vitest runs this contract in Node; the browser app intentionally omits Node types.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtime = globalThis as typeof globalThis & { process: { cwd: () => string } };
const migration = readFileSync(
  `${runtime.process.cwd()}/supabase/migrations/20260823193000_preserve_final_five_role_access_on_reset.sql`,
  'utf8',
).replace(/\s+/g, ' ').toLowerCase();

describe('rehearsal reset role access preservation', () => {
  it('snapshots active Liza/Viktor access before the legacy reset helper deletes it', () => {
    expect(migration).toContain('from public.final_five_role_access access');
    expect(migration).toContain('access.revoked_at is null');
    expect(migration).toContain('v_preserved_role_access');
    expect(migration).toContain('public._owner_reset_event_test_data_without_v2');
  });

  it('restores the same token hashes after reset so existing personal URLs remain valid', () => {
    expect(migration).toContain('insert into public.final_five_role_access');
    expect(migration).toContain("item->>'tokenhash'");
    expect(migration).toContain("item->>'issuedat'");
    expect(migration).toContain('on conflict (event_id, role) do update');
  });

  it('does not make revoked credentials live again', () => {
    expect(migration).toContain('access.revoked_at is null');
    expect(migration).toContain('revoked_at = null');
  });
});
