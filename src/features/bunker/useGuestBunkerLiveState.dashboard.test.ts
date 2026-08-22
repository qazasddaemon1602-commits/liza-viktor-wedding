import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BunkerV2ActiveGuestRuntime } from './v2/contracts';
import type { BunkerV2DashboardReadModel } from './v2/dashboard.service';
import { useGuestBunkerLiveState, type GuestBunkerLiveDependencies } from './useGuestBunkerLiveState';

const serverNow = '2026-08-30T18:50:00Z';

function runtime(state: 'MISSION_03' | 'MISSION_05'): BunkerV2ActiveGuestRuntime {
  return {
    contractVersion: 2,
    status: 'active',
    serverNow,
    state,
    planVersion: 1,
    runNonce: 'run-1',
    viewer: {
      kind: 'guest',
      guest: { id: 'guest-1', realName: 'Анна' },
      wagon: { number: 1, label: 'ВАГОН №1' },
    },
    character: {
      profileKey: 'architect',
      profileVersion: 1,
      profession: 'АРХИТЕКТОР',
      health: 'хорошее',
      visibleSkill: 'чтение чертежей',
      specialAbility: 'plan_analysis',
      abilityDescription: 'Анализирует план.',
      abilityUsesRemaining: 1,
      status: 'active',
      m01Eligibility: 'frozen_member',
      hiddenTraitRevealed: false,
    },
    currentMission: {
      instanceId: state === 'MISSION_03' ? 'm03' : 'm05',
      instanceVersion: 1,
      code: state,
      status: 'active',
      scope: 'wagon',
    },
  };
}

function dashboard(available: number): Extract<BunkerV2DashboardReadModel, { status: 'active' }> {
  return {
    contractVersion: 2,
    status: 'active',
    serverNow,
    wagon: { id: 'wagon-1', number: 1, label: 'ВАГОН №1' },
    passengers: [{
      guestId: 'guest-1',
      realName: 'Анна',
      profession: 'АРХИТЕКТОР',
      visibleSkill: 'чтение чертежей',
      characterStatus: 'active',
      hiddenTraitRevealed: false,
    }],
    inventory: [{ itemKey: 'water', available, used: 1, transferred: 0, lost: 0 }],
    archive: [{
      artifactKey: 'BK-17',
      contentType: 'document',
      decryptionStatus: 'decoded',
      scope: 'wagon',
      content: { title: 'BK-17' },
    }],
    wagonState: {
      powerStatus: 'stable',
      communicationStatus: 'working',
      navigationStatus: 'working',
      technicalDoorStatus: 'unlocked',
      trackDamage: 5,
      waterStatus: 'stable',
      routeChoice: null,
      routeBonus: 0,
      powerInstability: 0,
      sector04Found: false,
      coordinationBonus: false,
    },
  };
}

const missionThree = {
  contractVersion: 2 as const,
  status: 'active' as const,
  serverNow,
  deadlineAt: '2026-08-30T18:56:00Z',
  instanceId: 'm03',
  instanceVersion: 1,
  title: 'Аварийный запас',
  intro: 'Выберите проблемы.',
  wagon: { number: 1, label: 'ВАГОН №1' },
  memberRole: 'captain' as const,
  problems: [],
  inventory: [],
  selectedProblems: [],
  ability: null,
  pendingCommitments: [],
};

describe('persistent dashboard live state', () => {
  it('keeps the last dashboard across M03 → M05 and a temporary dashboard failure', async () => {
    let currentRuntime = runtime('MISSION_03');
    let currentDashboard = dashboard(1);
    let dashboardOffline = false;

    const deps: GuestBunkerLiveDependencies = {
      getDeviceKey: () => 'device-1',
      load: vi.fn().mockResolvedValue({ status: 'idle', serverNow }),
      loadRuntime: vi.fn(async () => currentRuntime),
      loadDashboard: vi.fn(async () => {
        if (dashboardOffline) throw new Error('offline');
        return currentDashboard;
      }),
      loadMissionThree: vi.fn().mockResolvedValue(missionThree),
      submitMission: vi.fn(),
      submitFinalCode: vi.fn(),
    };

    const { result } = renderHook(() => useGuestBunkerLiveState({ dependencies: deps }));

    await waitFor(() => expect(result.current.dashboard).toEqual(dashboard(1)));
    await waitFor(() => expect(result.current.missionThree?.instanceId).toBe('m03'));

    currentRuntime = runtime('MISSION_05');
    dashboardOffline = true;
    await act(async () => { await result.current.reload(); });

    await waitFor(() => expect(result.current.runtime).toMatchObject({ state: 'MISSION_05' }));
    await waitFor(() => expect(result.current.dashboardError).toMatch(/последние/i));
    expect(result.current.dashboard).toEqual(dashboard(1));
    expect(result.current.missionThree).toBeUndefined();

    dashboardOffline = false;
    currentDashboard = dashboard(2);
    await act(async () => { await result.current.reload(); });

    await waitFor(() => expect(result.current.dashboard?.status).toBe('active'));
    await waitFor(() => expect(result.current.dashboardError).toBe(''));
    expect(result.current.dashboard).toEqual(dashboard(2));
  });
});
