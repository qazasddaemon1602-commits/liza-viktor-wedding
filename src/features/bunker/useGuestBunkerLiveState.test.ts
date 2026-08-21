import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuestBunkerQuestState } from './bunkerQuest.types';
import type { ActiveGuestBunkerRuntime } from './bunkerRuntime.service';
import type { BunkerV2ActiveGuestRuntime } from './v2/contracts';
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

const lateGuestRuntime = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-21T18:00:00.000Z',
  state: 'MISSION_03',
  planVersion: 1,
  runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
  viewer: {
    kind: 'guest',
    guest: { id: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42', realName: 'Поздний Г.' },
    wagon: { number: 2, label: 'Вагон №2' },
  },
  character: {
    profileKey: 'mechanic', profileVersion: 2, profession: 'МЕХАНИК', health: 'отличное',
    visibleSkill: 'ремонт', specialAbility: 'mechanical_fix', abilityDescription: 'Ремонт.',
    abilityUsesRemaining: 1, status: 'saved', m01Eligibility: 'late_joiner',
    hiddenTraitRevealed: false,
  },
  currentMission: {
    instanceId: '9e7d6779-f551-4c83-8582-0523e7d02171', instanceVersion: 1,
    code: 'MISSION_03', status: 'active', scope: 'wagon',
  },
} satisfies BunkerV2ActiveGuestRuntime;

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
  it('loads the frozen M01 read model and submits against its authoritative instance version', async () => {
    const loadMissionOne = vi.fn().mockResolvedValue({
      contractVersion: 2,
      status: 'active',
      serverNow: '2026-08-21T18:00:01.000Z',
      deadlineAt: '2026-08-21T18:04:00.000Z',
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 3,
      wagon: { id: 'carriage-2', number: 2, label: 'ВАГОН №2' },
      quota: 1,
      members: [{
        guestId: 'guest-1', realName: 'Александра-Мария Константинопольская',
        profession: 'Инженер', health: 'Здорова', visibleSkill: 'Чинит механизмы',
      }],
      selectedGuestIds: [],
    });
    const confirmMissionOne = vi.fn().mockResolvedValue({
      contractVersion: 2, status: 'accepted', commandId: 'command-1', commandType: 'mission_confirm',
    });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = deps({ loadMissionOne, confirmMissionOne, broadcastRefresh });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));

    await waitFor(() => expect(result.current.missionOne).toMatchObject({
      instanceVersion: 3, remainingSeconds: 239,
    }));
    await act(async () => result.current.confirmMissionOne(['guest-1']));

    expect(confirmMissionOne).toHaveBeenCalledWith('device-key-123', expect.objectContaining({
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 3,
      selectedGuestIds: ['guest-1'],
      commandId: expect.any(String),
    }));
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
  });

  it('recovers a completed authoritative M01 outcome after an ambiguous confirm failure', async () => {
    const active = {
      contractVersion: 2 as const,
      status: 'active' as const,
      serverNow: '2026-08-21T18:00:01.000Z',
      deadlineAt: '2026-08-21T18:04:00.000Z',
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 1,
      wagon: { id: 'carriage-2', number: 2, label: 'ВАГОН №2' },
      quota: 1,
      members: [{
        guestId: 'guest-1', realName: 'Анна Петрова', profession: 'Инженер',
        health: 'Здорова', visibleSkill: 'Чинит механизмы',
      }],
      selectedGuestIds: [],
    };
    const completed = {
      ...active,
      status: 'completed' as const,
      serverNow: '2026-08-21T18:00:03.000Z',
      selectedGuestIds: ['guest-1'],
    };
    const loadMissionOne = vi.fn()
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(completed);
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = deps({
      loadMissionOne,
      confirmMissionOne: vi.fn().mockRejectedValue(new Error('response lost')),
      broadcastRefresh,
    });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.missionOne?.status).toBe('active'));

    await act(async () => result.current.confirmMissionOne(['guest-1']));

    expect(loadMissionOne).toHaveBeenCalledTimes(2);
    expect(result.current.missionOne).toMatchObject({
      status: 'completed', selectedGuestIds: ['guest-1'],
    });
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
  });

  it('rereads an active M01 after an ambiguous confirm failure before allowing retry', async () => {
    const active = {
      contractVersion: 2 as const,
      status: 'active' as const,
      serverNow: '2026-08-21T18:00:01.000Z',
      deadlineAt: '2026-08-21T18:04:00.000Z',
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 1,
      wagon: { id: 'carriage-2', number: 2, label: 'ВАГОН №2' },
      quota: 1,
      members: [{
        guestId: 'guest-1', realName: 'Анна Петрова', profession: 'Инженер',
        health: 'Здорова', visibleSkill: 'Чинит механизмы',
      }],
      selectedGuestIds: [],
    };
    const loadMissionOne = vi.fn().mockResolvedValue(active);
    const failure = new Error('response lost');
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const dependencies = deps({
      loadMissionOne,
      confirmMissionOne: vi.fn().mockRejectedValue(failure),
      broadcastRefresh,
    });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(result.current.missionOne?.status).toBe('active'));

    await expect(act(async () => result.current.confirmMissionOne(['guest-1'])))
      .rejects.toThrow('response lost');

    expect(loadMissionOne).toHaveBeenCalledTimes(2);
    expect(result.current.missionOne).toMatchObject({ status: 'active', connection: 'online' });
    expect(broadcastRefresh).not.toHaveBeenCalled();
  });

  it('keeps a reconnected late V2 guest on the active polling cadence', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    const dependencies = deps({
      loadRuntime: vi.fn().mockResolvedValue(lateGuestRuntime),
    });
    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies }));

    await waitFor(() => expect(result.current.runtime).toEqual(lateGuestRuntime));

    expect(result.current.runtime).toMatchObject({
      character: { status: 'saved', m01Eligibility: 'late_joiner' },
    });
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 2_000);
    interval.mockRestore();
  });

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

  it('reloads immediately when the browser reports that the network is online again', async () => {
    const load = vi.fn().mockResolvedValue({
      status: 'idle', serverNow: '2026-08-30T17:59:00.000Z',
    });
    const dependencies = deps({ load });
    renderHook(() => useGuestBunkerLiveState({ dependencies }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => window.dispatchEvent(new Event('online')));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
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
