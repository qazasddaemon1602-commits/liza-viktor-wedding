import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mocked.rpc }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies final-five wiring', () => {
  beforeEach(() => mocked.rpc.mockReset());

  it('wires the secure final-five RPCs and role URLs', async () => {
    mocked.rpc
      .mockResolvedValueOnce({ data: { status: 'ready', questionCount: 5 }, error: null })
      .mockResolvedValueOnce({ data: { status: 'issued', role: 'liza', token: 'liza-secret' }, error: null })
      .mockResolvedValueOnce({ data: { status: 'ok', current: true, phase: 'voting', answeredCount: 20, lizaAnswered: true, viktorAnswered: false, revealed: false }, error: null })
      .mockResolvedValueOnce({ data: { status: 'revealed', questionId: 'f1' }, error: null });

    const deps = createAdminPageDependencies();
    expect(deps.finalFive).toBeDefined();

    await expect(deps.finalFive!.seed('event-1')).resolves.toEqual({ status: 'ready', questionCount: 5 });
    await expect(deps.finalFive!.issueRole('event-1', 'liza')).resolves.toEqual({ status: 'issued', role: 'liza', token: 'liza-secret' });
    await expect(deps.finalFive!.loadStatus('event-1', 'f1')).resolves.toMatchObject({ lizaAnswered: true, viktorAnswered: false });
    await expect(deps.finalFive!.revealFinal('event-1', 'f1')).resolves.toEqual({ status: 'revealed', questionId: 'f1' });

    const url = new URL(deps.finalFive!.buildRoleUrl('liza', 'abc'));
    expect(url.pathname).toBe('/liza');
    expect(url.searchParams.get('token')).toBe('abc');
  });
});
