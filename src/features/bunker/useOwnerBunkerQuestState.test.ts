import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OwnerBunkerQuestState } from './bunkerQuest.types';
import { useOwnerBunkerQuestState, type OwnerBunkerQuestDependencies } from './useOwnerBunkerQuestState';

const active: OwnerBunkerQuestState = {
  status: 'active',
  phase: 'dossier_1',
  phaseStartedAt: '2026-08-30T18:02:00.000Z',
  startedAt: '2026-08-30T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 1680,
  soundEnabled: true,
  unlocked: false,
  teams: [],
  serverNow: '2026-08-30T18:02:00.000Z',
};

function deps(overrides: Partial<OwnerBunkerQuestDependencies> = {}): OwnerBunkerQuestDependencies {
  return {
    load: vi.fn().mockResolvedValue(active),
    begin: vi.fn().mockResolvedValue(active),
    advance: vi.fn().mockResolvedValue(active),
    resetStage: vi.fn().mockResolvedValue(active),
    forceStage: vi.fn().mockResolvedValue(active),
    unlock: vi.fn().mockResolvedValue(active),
    broadcast: vi.fn().mockResolvedValue(undefined),
    subscribeToRefresh: () => vi.fn(),
    ...overrides,
  };
}

describe('useOwnerBunkerQuestState', () => {
  it('loads owner state and reloads after realtime invalidation', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn().mockResolvedValue(active);
    const dependencies = deps({
      load,
      subscribeToRefresh: (callback) => {
        refresh = callback;
        return vi.fn();
      },
    });
    const { result } = renderHook(() => useOwnerBunkerQuestState('event-1', { dependencies }));
    await waitFor(() => expect(result.current.state?.status).toBe('active'));

    act(() => refresh?.());
    await waitFor(() => expect(load.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('executes mutation before refresh broadcast and always reloads authoritative state', async () => {
    const order: string[] = [];
    const begin = vi.fn().mockImplementation(async () => { order.push('begin'); return active; });
    const broadcast = vi.fn().mockImplementation(async () => { order.push('broadcast'); });
    const load = vi.fn().mockImplementation(async () => { order.push('load'); return active; });
    const { result } = renderHook(() => useOwnerBunkerQuestState('event-1', { dependencies: deps({ begin, broadcast, load }) }));
    await waitFor(() => expect(result.current.state).not.toBeNull());
    order.length = 0;

    await act(async () => { await result.current.begin(); });
    expect(order[0]).toBe('begin');
    expect(order).toContain('broadcast');
    expect(order.at(-1)).toBe('load');
  });

  it('does not turn a lost broadcast into a duplicate owner mutation', async () => {
    const begin = vi.fn().mockResolvedValue(active);
    const broadcast = vi.fn().mockRejectedValue(new Error('offline'));
    const load = vi.fn().mockResolvedValue(active);
    const { result } = renderHook(() => useOwnerBunkerQuestState('event-1', { dependencies: deps({ begin, broadcast, load }) }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => { await result.current.begin(); });
    expect(begin).toHaveBeenCalledTimes(1);
    expect(result.current.warning).toMatch(/синхронизац/i);
  });
});

