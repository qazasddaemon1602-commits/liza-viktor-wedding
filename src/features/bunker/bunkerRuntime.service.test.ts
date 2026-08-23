import { describe, expect, it, vi } from 'vitest';
import {
  parseGuestBunkerRuntime,
  useGuestBunkerAbility,
} from './bunkerRuntime.service';

const activeRuntime = {
  status: 'active',
  serverNow: '2026-08-20T18:00:00.000Z',
  game: {
    runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
    state: 'MISSION_03',
    mode: 'production',
    finalStartedAt: null,
    finalDuration: 1800,
    bunkerRevealed: false,
  },
  guest: {
    id: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
    realName: 'Сергей П.',
    joinedLate: true,
  },
  wagon: { id: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6', number: 2, label: 'Вагон №2' },
  character: {
    profession: 'МЕХАНИК', health: 'отличное', visibleSkill: 'ремонт механизмов',
    hiddenTrait: null, hiddenTraitRevealed: false, specialAbility: 'mechanical_fix',
    abilityDescription: 'Открывает отсек.', abilityUsesRemaining: 1, status: 'active',
    abilityAction: {
      applicable: true,
      code: 'ability_available',
      missionState: 'MISSION_03',
      title: 'Ремонтный доступ',
      effectKind: 'technical_door_unlocked',
      effectPreview: 'Технический отсек будет разблокирован без расходования инструментов.',
    },
  },
  passengers: [], inventory: [], archive: [],
  wagonState: {
    powerStatus: 'unstable', communicationStatus: 'working', navigationStatus: 'working',
    technicalDoorStatus: 'locked', trackDamage: 0, waterStatus: 'stable', routeChoice: null,
    routeBonus: 0, powerInstability: 0, sector04Found: false, coordinationBonus: false,
  },
  currentMission: {
    id: 'mission-03',
    state: 'MISSION_03',
    plan: null,
  },
  missionAction: {
    missionState: 'MISSION_03',
    completed: false,
    completedAt: null,
    submittedPayload: null,
    requirements: {
      availableItemKeys: ['medkit', 'radio', 'water'],
      minItems: 1,
      maxItems: 3,
    },
  },
};

describe('Bunker runtime response', () => {
  it('restores the complete guest/wagon state and late-join marker', () => {
    expect(parseGuestBunkerRuntime(activeRuntime)).toMatchObject({
      status: 'active',
      guest: { realName: 'Сергей П.', joinedLate: true },
      game: { state: 'MISSION_03', finalDuration: 1800 },
      character: {
        profession: 'МЕХАНИК',
        hiddenTrait: null,
        abilityAction: {
          applicable: true,
          code: 'ability_available',
          missionState: 'MISSION_03',
          effectKind: 'technical_door_unlocked',
        },
      },
      currentMission: { id: 'mission-03', state: 'MISSION_03', plan: null },
      missionAction: {
        missionState: 'MISSION_03', completed: false, completedAt: null,
        requirements: { availableItemKeys: ['medkit', 'radio', 'water'] },
      },
    });
  });

  it('rejects a mission snapshot that does not match the authoritative game state', () => {
    expect(() => parseGuestBunkerRuntime({
      ...activeRuntime,
      currentMission: { id: 'mission-04', state: 'MISSION_04', plan: null },
    })).toThrow(/mission state/i);
  });

  it('accepts the authoritative array plan used by Mission 01, Mission 06, and the final', () => {
    expect(parseGuestBunkerRuntime({
      ...activeRuntime,
      game: { ...activeRuntime.game, state: 'MISSION_01' },
      character: {
        ...activeRuntime.character,
        abilityAction: {
          applicable: false,
          code: 'ability_not_applicable',
          missionState: 'MISSION_01',
          title: 'Сейчас способность недоступна',
          effectKind: null,
          effectPreview: 'В первом задании способности отключены.',
        },
      },
      currentMission: {
        id: 'mission_01',
        state: 'MISSION_01',
        plan: [{ wagonId: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6', exclusionCount: 2 }],
      },
      missionAction: {
        missionState: 'MISSION_01', completed: false, completedAt: null,
        submittedPayload: null,
        requirements: { exclusionCount: 2, selectableProfiles: [] },
      },
    })).toMatchObject({
      currentMission: {
        id: 'mission_01',
        state: 'MISSION_01',
        plan: [{ wagonId: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6', exclusionCount: 2 }],
      },
    });
  });

  it('accepts an idle response before a game is prepared', () => {
    expect(parseGuestBunkerRuntime({
      status: 'idle', serverNow: '2026-08-20T18:00:00.000Z',
    })).toEqual({ status: 'idle', serverNow: '2026-08-20T18:00:00.000Z' });
  });

  it('rejects mission action progress for a different authoritative mission', () => {
    expect(() => parseGuestBunkerRuntime({
      ...activeRuntime,
      missionAction: { ...activeRuntime.missionAction, missionState: 'MISSION_04' },
    })).toThrow(/mission action/i);
  });

  it('accepts no action outside the six actionable missions', () => {
    expect(parseGuestBunkerRuntime({
      ...activeRuntime,
      game: { ...activeRuntime.game, state: 'BREAK' },
      character: {
        ...activeRuntime.character,
        abilityAction: {
          applicable: false,
          code: 'ability_not_applicable',
          missionState: 'BREAK',
          title: 'Сейчас способность недоступна',
          effectKind: null,
          effectPreview: 'Дождитесь следующего задания.',
        },
      },
      currentMission: null,
      missionAction: null,
    })).toMatchObject({ status: 'active', missionAction: null });
  });

  it('rejects malformed inventory lots before they can be offered for a real transfer', () => {
    expect(() => parseGuestBunkerRuntime({
      ...activeRuntime,
      inventory: [{
        id: 'lot-1', itemKey: 'radio', quantity: 0, status: 'available',
        acquiredAt: '2026-08-20T18:00:00.000Z', usedAt: null,
        transferredTo: null, sourceLotId: null,
      }],
    })).toThrow(/inventory item/i);
  });

  it('rejects a leaked hidden trait before reveal', () => {
    expect(() => parseGuestBunkerRuntime({
      ...activeRuntime,
      character: { ...activeRuntime.character, hiddenTrait: 'СЕКРЕТ' },
    })).toThrow(/hidden trait/i);
  });

  it('rejects an ability preview that claims a different server mission', () => {
    expect(() => parseGuestBunkerRuntime({
      ...activeRuntime,
      character: {
        ...activeRuntime.character,
        abilityAction: {
          ...activeRuntime.character.abilityAction,
          missionState: 'MISSION_05',
        },
      },
    })).toThrow(/ability action/i);
  });
});

describe('Bunker character ability RPC', () => {
  it('sends only device identity plus an idempotency key and parses the server-derived result', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'used',
        changed: true,
        idempotent: false,
        clientActionId: '00000000-0000-4000-8000-000000000951',
        missionState: 'MISSION_03',
        abilityKey: 'mechanical_fix',
        effectKind: 'technical_door_unlocked',
        effectPreview: 'Технический отсек будет разблокирован без расходования инструментов.',
        resultCopy: 'Механик разблокировал технический отсек вагона.',
        abilityUsesRemaining: 0,
      },
      error: null,
    });

    await expect(useGuestBunkerAbility(
      { rpc },
      'liza-viktor',
      'device-key-123',
      '00000000-0000-4000-8000-000000000951',
    )).resolves.toMatchObject({
      status: 'used',
      missionState: 'MISSION_03',
      abilityKey: 'mechanical_fix',
      abilityUsesRemaining: 0,
    });
    expect(rpc).toHaveBeenCalledWith('use_guest_bunker_ability', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-key-123',
      p_client_action_id: '00000000-0000-4000-8000-000000000951',
    });
  });

  it('rejects a malformed ability result instead of inventing client state', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: 'used',
        changed: true,
        idempotent: false,
        clientActionId: '00000000-0000-4000-8000-000000000951',
        missionState: 'MISSION_03',
        abilityKey: 'mechanical_fix',
        effectKind: 'technical_door_unlocked',
        effectPreview: 'Технический отсек будет разблокирован.',
        resultCopy: 'Технический отсек разблокирован.',
        abilityUsesRemaining: -1,
      },
      error: null,
    });

    await expect(useGuestBunkerAbility(
      { rpc },
      'liza-viktor',
      'device-key-123',
      '00000000-0000-4000-8000-000000000951',
    )).rejects.toThrow(/ability result/i);
  });
});
