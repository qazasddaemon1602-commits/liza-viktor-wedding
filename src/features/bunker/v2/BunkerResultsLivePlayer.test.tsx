import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BunkerResultsLivePlayer } from './BunkerResultsLivePlayer';

const result = {
  contractVersion: 2 as const,
  status: 'completed' as const,
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
};

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('BunkerResultsLivePlayer', () => {
  it('loads and renders the public ending without asking the guest to refresh', async () => {
    const load = vi.fn().mockResolvedValue(result);
    render(<BunkerResultsLivePlayer dependencies={{ load, subscribe: () => vi.fn() }} />);
    await flush();
    expect(load).toHaveBeenCalled();
    expect(await screen.findByRole('region', { name: 'Итоги Бункера' })).toHaveTextContent('БУНКЕР ОТКРЫТ');
  });
});
