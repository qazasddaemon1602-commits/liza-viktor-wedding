import { describe, expect, it } from 'vitest';
import { parseGuestBunkerRuntime } from './bunkerRuntime.service';

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
