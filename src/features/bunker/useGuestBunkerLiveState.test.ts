import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuestBunkerQuestState } from './bunkerQuest.types';
import { useGuestBunkerLiveState, type GuestBunkerLiveDependencies } from './useGuestBunkerLiveState';

const emergency: GuestBunkerQuestState = {
  status: 'active',
  phase: 'emergency',
  phaseStartedAt: '2026-08-30T18:00:00.000Z',
  startedAt: '2026-08-30T18:00:00.000Z',
  durationSeconds: 1800,
  remainingSeconds: 1800,
  serverNow: '2026-08-30T18:00:00.000Z',
  dossier: null,
  team: null,
  final: { unlocked: false },
};

function deps(overrides: Partial<GuestBunkerLiveDependencies> = {}): GuestBunkerLiveDependencies {
  return {
    getDeviceKey: () => 'device-key-123',
    load: vi.fn().mockResolvedValue({ status: 'idle', serverNow: '2026-08-30T17:59:00.000Z' }),
    submitMission: vi.fn().mockResolvedValue({ status: 'completed', stage: 'mission_a' }),
    submitFinalCode: vi.fn().mockResolvedValue({ status: 'incorrect', unlocked: false }),
    subscribeToRefresh: () => vi.fn(),
    ...overrides,
  };
}

describe('useGuestBunkerLiveState', () => {
  it('loads authoritative Bunker state and reloads from a refresh signal', async () => {
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce({ status: 'idle', serverNow: '2026-08-30T17:59:00.000Z' })
      .mockResolvedValueOnce(emergency);
    const dependencies = deps({
      load,
      subscribeToRefresh: (callback) => {
        refresh = callback;
        return vi.fn();
      },
    });

    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.state?.status).toBe('idle'));

    act(() => refresh?.());
    await waitFor(() => expect(result.current.state?.status).toBe('active'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reloads after a carriage mission attempt and exposes retry feedback', async () => {
    const load = vi.fn().mockResolvedValue(emergency);
    const submitMission = vi.fn().mockResolvedValue({ status: 'incorrect', stage: 'mission_a', attemptCount: 2 });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies: deps({ load, submitMission }) }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.submitMission('mission_a', 'bad');
    });

    expect(submitMission).toHaveBeenCalledWith('device-key-123', 'mission_a', 'bad');
    expect(result.current.feedback).toMatch(/не подошёл/i);
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reloads after final unlock and uses a neutral wrong-code message', async () => {
    const submitFinalCode = vi.fn().mockResolvedValue({ status: 'incorrect', unlocked: false });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies: deps({ submitFinalCode }) }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.submitFinalCode('0000000000');
    });

    expect(result.current.feedback).toMatch(/код не подошёл/i);
  });
});
