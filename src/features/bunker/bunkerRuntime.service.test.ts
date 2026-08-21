import { describe, expect, it, vi } from 'vitest';
import { getGuestBunkerRuntime, parseGuestBunkerRuntime } from './bunkerRuntime.service';
import type { BunkerRpcClient } from './bunker.service';

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
};

describe('Bunker runtime response', () => {
  it('routes the production guest read by contractVersion without changing the V1 result', async () => {
    const read = (data: unknown) => getGuestBunkerRuntime(
      { rpc: vi.fn().mockResolvedValue({ data, error: null }) } satisfies BunkerRpcClient,
      'wedding',
      'device-key',
    );
    const v1 = await read({
      ...activeRuntime,
      contractVersion: 1,
      game: { ...activeRuntime.game, state: 'STORY_BUNKER' },
      currentMission: { id: 'story', state: 'STORY_BUNKER', plan: null },
    });
    expect(v1).toMatchObject({ status: 'active', game: { state: 'STORY_BUNKER' } });
    expect(v1).not.toHaveProperty('contractVersion');

    const v2 = {
      contractVersion: 2,
      status: 'active',
      serverNow: '2026-08-21T18:00:00.000Z',
      state: 'UNKNOWN_PASSENGER',
      planVersion: 1,
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      viewer: {
        kind: 'guest',
        guest: { id: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42', realName: 'Сергей П.' },
        wagon: { number: 2, label: 'Вагон №2' },
      },
      character: {
        profileKey: 'mechanic', profileVersion: 2, profession: 'МЕХАНИК', health: 'отличное',
        visibleSkill: 'ремонт', specialAbility: 'mechanical_fix', abilityDescription: 'Ремонт.',
        abilityUsesRemaining: 1, status: 'saved', m01Eligibility: 'frozen_member',
        hiddenTraitRevealed: false,
      },
      currentMission: {
        instanceId: '9e7d6779-f551-4c83-8582-0523e7d02171', instanceVersion: 1,
        code: 'UNKNOWN_PASSENGER', status: 'active', scope: 'global',
      },
    };
    await expect(read(v2)).resolves.toMatchObject({
      contractVersion: 2, state: 'UNKNOWN_PASSENGER', viewer: { kind: 'guest' },
    });
    await expect(read({ ...v2, state: 'STORY_BUNKER' })).rejects.toThrow(/state/i);
  });

  it('restores the complete guest/wagon state and late-join marker', () => {
    expect(parseGuestBunkerRuntime(activeRuntime)).toMatchObject({
      status: 'active',
      guest: { realName: 'Сергей П.', joinedLate: true },
      game: { state: 'MISSION_03', finalDuration: 1800 },
      character: { profession: 'МЕХАНИК', hiddenTrait: null },
      currentMission: { id: 'mission-03', state: 'MISSION_03', plan: null },
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
      currentMission: {
        id: 'mission_01',
        state: 'MISSION_01',
        plan: [{ wagonId: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6', exclusionCount: 2 }],
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

  it('rejects a leaked hidden trait before reveal', () => {
    expect(() => parseGuestBunkerRuntime({
      ...activeRuntime,
      character: { ...activeRuntime.character, hiddenTrait: 'СЕКРЕТ' },
    })).toThrow(/hidden trait/i);
  });
});
