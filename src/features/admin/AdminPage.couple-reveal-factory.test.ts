import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mocked.rpc }),
}));

import { createAdminPageDependencies } from './AdminPage';

describe('createAdminPageDependencies joint-answer reveal wiring', () => {
  beforeEach(() => {
    mocked.rpc.mockReset();
  });

  it('wires owner readiness and the explicit second reveal to the real Supabase RPC client', async () => {
    mocked.rpc
      .mockResolvedValueOnce({ data: { status: 'ready', revealed: false }, error: null })
      .mockResolvedValueOnce({ data: { status: 'revealed', questionId: 'question-1' }, error: null });

    const deps = createAdminPageDependencies();

    expect(deps.quiz?.loadCoupleRevealStatus).toBeTypeOf('function');
    expect(deps.quiz?.revealCoupleAnswer).toBeTypeOf('function');

    await expect(deps.quiz!.loadCoupleRevealStatus!('event-1', 'question-1')).resolves.toEqual({
      status: 'ready',
      revealed: false,
    });
    await expect(deps.quiz!.revealCoupleAnswer!('event-1', 'question-1')).resolves.toEqual({
      status: 'revealed',
      questionId: 'question-1',
    });

    expect(mocked.rpc).toHaveBeenNthCalledWith(1, 'owner_get_couple_reveal_status', {
      p_event_id: 'event-1',
      p_question_id: 'question-1',
    });
    expect(mocked.rpc).toHaveBeenNthCalledWith(2, 'owner_reveal_couple_preanswer', {
      p_event_id: 'event-1',
      p_question_id: 'question-1',
    });
  });
});
