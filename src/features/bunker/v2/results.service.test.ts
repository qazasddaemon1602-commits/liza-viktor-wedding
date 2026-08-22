import { describe, expect, it, vi } from 'vitest';
import { getBunkerV2Results, parseBunkerV2Results } from './results.service';

const completed = {
  contractVersion: 2,
  status: 'completed',
  serverNow: '2026-08-30T19:40:00.000Z',
  finishTimeSeconds: 742,
  emergencyOpen: false,
  characters: { active: 1, saved: 16, excluded: 3 },
  archiveFound: 4,
  resourcesRemaining: 7,
  resourcesUsed: 5,
  tradesCompleted: 2,
  wrongAttempts: 1,
  hintsUsed: 1,
  skillsUsed: 4,
  missionsCompleted: 6,
  missionsTotal: 6,
  coordinationScore: 91,
} as const;

describe('Bunker V2 results', () => {
  it('parses only public non-secret statistics', () => {
    expect(parseBunkerV2Results(completed)).toEqual(completed);
    expect(JSON.stringify(completed)).not.toContain('4719');
    expect(JSON.stringify(completed)).not.toContain('LV0830');
  });

  it('loads the result from the public result RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: completed, error: null });
    await expect(getBunkerV2Results({ rpc }, 'liza-viktor')).resolves.toEqual(completed);
    expect(rpc).toHaveBeenCalledWith('get_bunker_v2_results', { p_event_slug: 'liza-viktor' });
  });

  it('rejects malformed statistics instead of guessing', () => {
    expect(() => parseBunkerV2Results({ ...completed, coordinationScore: 130 })).toThrow(/results/i);
    expect(() => parseBunkerV2Results({ ...completed, characters: { saved: -1 } })).toThrow(/results/i);
    expect(() => parseBunkerV2Results({ ...completed, emergencyOpen: 'false' })).toThrow(/results/i);
    expect(() => parseBunkerV2Results({ ...completed, missionsTotal: 18 })).toThrow(/results/i);
  });
});
