import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuestBunkerQuestState } from './bunkerQuest.types';
import type { ActiveGuestBunkerRuntime } from './bunkerRuntime.service';
import { useGuestBunkerLiveState, type GuestBunkerLiveDependencies } from './useGuestBunkerLiveState';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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

const runtime: ActiveGuestBunkerRuntime = {
  status: 'active', serverNow: '2026-08-20T18:00:00.000Z',
  game: { runNonce: 'run-1', state: 'MISSION_03', mode: 'production', finalStartedAt: null, finalDuration: 1800, bunkerRevealed: false },
  guest: { id: 'guest-1', realName: 'Сергей П.', joinedLate: false },
  wagon: { id: 'wagon-2', number: 2, label: 'Вагон №2' },
  character: {
    profession: 'МЕХАНИК', health: 'отличное', visibleSkill: 'ремонт механизмов',
    hiddenTrait: null, hiddenTraitRevealed: false, specialAbility: 'mechanical_fix',
    abilityDescription: 'Открывает технический отсек.', abilityUsesRemaining: 1, status: 'active',
  },
  passengers: [], inventory: [], archive: [],
  wagonState: { powerStatus: 'stable', communicationStatus: 'working', navigationStatus: 'working' },
  currentMission: null,
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
  it('keeps the newest quest, runtime, loading, and error state when an older reload settles last', async () => {
    const oldQuest = deferred<GuestBunkerQuestState>();
    const newQuest = deferred<GuestBunkerQuestState>();
    const oldRuntime = deferred<ActiveGuestBunkerRuntime>();
    const newRuntime = deferred<{ status: 'idle'; serverNow: string }>();
    const load = vi.fn()
      .mockReturnValueOnce(oldQuest.promise)
      .mockReturnValueOnce(newQuest.promise);
    const loadRuntime = vi.fn()
      .mockReturnValueOnce(oldRuntime.promise)
      .mockReturnValueOnce(newRuntime.promise);
    const dependencies = deps({ load, loadRuntime });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => { void result.current.reload(); });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));

    const newestIdle = { status: 'idle' as const, serverNow: '2026-08-20T18:01:00.000Z' };
    await act(async () => {
      newQuest.resolve(newestIdle);
      newRuntime.resolve(newestIdle);
      await Promise.all([newQuest.promise, newRuntime.promise]);
    });
    await waitFor(() => expect(result.current.runtimeLoading).toBe(false));

    await act(async () => {
      oldQuest.reject(new Error('stale offline'));
      oldRuntime.resolve(runtime);
      await oldRuntime.promise;
    });

    expect(result.current.state).toEqual(newestIdle);
    expect(result.current.runtime).toEqual(newestIdle);
    expect(result.current.error).toBe('');
    expect(result.current.runtimeError).toBe('');
    expect(result.current.runtimeLoading).toBe(false);
  });

  it('commits quest state and finishes mission submission while the runtime read is still pending', async () => {
    const pendingRuntime = deferred<ActiveGuestBunkerRuntime>();
    const load = vi.fn().mockResolvedValue(emergency);
    const submitMission = vi.fn().mockResolvedValue({ status: 'incorrect', stage: 'mission_a', attemptCount: 1 });
    const dependencies = deps({
      load,
      loadRuntime: vi.fn().mockReturnValue(pendingRuntime.promise),
      submitMission,
    });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));

    await waitFor(() => expect(result.current.state).toEqual(emergency));
    expect(result.current.runtimeLoading).toBe(true);

    await act(async () => {
      await result.current.submitMission('mission_a', 'bad');
    });

    expect(result.current.feedback).toMatch(/не подошёл/i);
    expect(result.current.submitting).toBe(false);
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.current.runtimeLoading).toBe(true);
  });

  it('loads the authoritative runtime and preserves its snapshot if a refresh goes offline', async () => {
    const loadRuntime = vi.fn()
      .mockResolvedValueOnce(runtime)
      .mockRejectedValueOnce(new Error('offline'));
    const dependencies = deps({ loadRuntime });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));

    await waitFor(() => expect(result.current.runtime).toEqual(runtime));
    await act(async () => { await result.current.reload(); });

    expect(result.current.runtime).toEqual(runtime);
    await waitFor(() => expect(result.current.runtimeError).toMatch(/защищённый архив/i));
    expect(result.current.runtimeLoading).toBe(false);
  });

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
    const dependencies = deps({ load, submitMission });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.submitMission('mission_a', 'bad');
    });

    expect(submitMission).toHaveBeenCalledWith('device-key-123', 'mission_a', 'bad');
    expect(result.current.feedback).toMatch(/не подошёл/i);
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('submits an authoritative global mission and reloads the wagon runtime', async () => {
    const load = vi.fn().mockResolvedValue(emergency);
    const submitGlobalMission = vi.fn().mockResolvedValue({
      status: 'completed',
      missionState: 'MISSION_03',
      carriageId: 'wagon-2',
      completedAt: '2026-08-30T18:05:00.000Z',
      changed: true,
      submittedPayload: { itemKeys: ['water'] },
    });
    const dependencies = deps({ load, submitGlobalMission });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.submitGlobalMission('MISSION_03', { itemKeys: ['water'] });
    });

    expect(submitGlobalMission).toHaveBeenCalledWith(
      'device-key-123',
      'MISSION_03',
      { itemKeys: ['water'] },
    );
    expect(result.current.feedback).toMatch(/решение вагона принято/i);
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reuses one client action id when an ability response is lost and reloads after success', async () => {
    const useAbility = vi.fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({
        status: 'used',
        changed: false,
        idempotent: true,
        clientActionId: '00000000-0000-4000-8000-000000000951',
        missionState: 'MISSION_03',
        abilityKey: 'mechanical_fix',
        effectKind: 'technical_door_unlocked',
        effectPreview: 'Технический отсек будет разблокирован.',
        resultCopy: 'Технический отсек разблокирован.',
        abilityUsesRemaining: 0,
      });
    const load = vi.fn().mockResolvedValue(emergency);
    const dependencies = deps({ load, useAbility });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.useAbility().catch(() => undefined);
    });
    expect(result.current.feedback).toMatch(/повторите/i);

    await act(async () => {
      await result.current.useAbility();
    });

    expect(useAbility).toHaveBeenCalledTimes(2);
    expect(useAbility.mock.calls[0][0]).toBe('device-key-123');
    expect(useAbility.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(useAbility.mock.calls[1][1]).toBe(useAbility.mock.calls[0][1]);
    expect(result.current.feedback).toMatch(/отсек разблокирован/i);
    expect(load.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reloads after final unlock and uses a neutral wrong-code message', async () => {
    const submitFinalCode = vi.fn().mockResolvedValue({ status: 'incorrect', unlocked: false });
    const dependencies = deps({ submitFinalCode });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.submitFinalCode('0000000000');
    });

    expect(result.current.feedback).toMatch(/код не подошёл/i);
  });
});
