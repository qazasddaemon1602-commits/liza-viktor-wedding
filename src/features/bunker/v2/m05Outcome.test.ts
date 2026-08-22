import { describe, expect, it } from 'vitest';
import { calculateMissionFiveOutcome, type MissionFiveOutcomeSnapshot } from './m05Outcome';

function snapshot(overrides: Partial<MissionFiveOutcomeSnapshot> = {}): MissionFiveOutcomeSnapshot {
  return {
    choice: 'A',
    scenarioKey: 'route_000000000000',
    inventory: [],
    savedProfileKeys: [],
    committedAbilityKeys: [],
    fallback: false,
    ...overrides,
  };
}

describe('deterministic M05 outcome engine', () => {
  it('awards the best A outcome when the wagon has navigation and technical support', () => {
    expect(calculateMissionFiveOutcome(snapshot({
      inventory: ['tools'],
      savedProfileKeys: ['train_driver'],
    }))).toEqual({
      routeChoice: 'A',
      routeBonusMinutes: 7,
      trackDamage: 0,
      powerInstability: 0,
      sector04Found: true,
      fallback: false,
      tier: 'best',
    });
  });

  it('awards the medium A outcome with one meaningful support category', () => {
    expect(calculateMissionFiveOutcome(snapshot({
      committedAbilityKeys: ['route_analysis'],
    }))).toEqual({
      routeChoice: 'A',
      routeBonusMinutes: 4,
      trackDamage: 0,
      powerInstability: 1,
      sector04Found: false,
      fallback: false,
      tier: 'medium',
    });
  });

  it('awards the poor A outcome without route support', () => {
    expect(calculateMissionFiveOutcome(snapshot())).toEqual({
      routeChoice: 'A',
      routeBonusMinutes: 0,
      trackDamage: 20,
      powerInstability: 0,
      sector04Found: false,
      fallback: false,
      tier: 'poor',
    });
  });

  it('makes B a stable five-minute detour', () => {
    expect(calculateMissionFiveOutcome(snapshot({ choice: 'B' }))).toEqual({
      routeChoice: 'B',
      routeBonusMinutes: -5,
      trackDamage: 0,
      powerInstability: 0,
      sector04Found: false,
      fallback: false,
      tier: 'safe',
    });
  });

  it('uses the same B outcome for timeout fallback and marks it explicitly', () => {
    expect(calculateMissionFiveOutcome(snapshot({ choice: 'B', fallback: true }))).toMatchObject({
      routeChoice: 'B',
      routeBonusMinutes: -5,
      trackDamage: 0,
      powerInstability: 0,
      fallback: true,
      tier: 'safe',
    });
  });

  it('counts approved navigation, physical and technical abilities as support', () => {
    for (const ability of [
      'route_analysis','terrain_analysis','route_feel','dangerous_route','physical_task',
      'map_reconstruction','mechanical_fix','power_restore','power_bypass','structure_analysis',
    ]) {
      expect(calculateMissionFiveOutcome(snapshot({ committedAbilityKeys: [ability] })).tier).toBe('medium');
    }
  });

  it('counts saved navigation/technical roles and current route inventory, but ignores unrelated data', () => {
    expect(calculateMissionFiveOutcome(snapshot({ savedProfileKeys: ['geologist'] })).tier).toBe('medium');
    expect(calculateMissionFiveOutcome(snapshot({ savedProfileKeys: ['mechanic'] })).tier).toBe('medium');
    expect(calculateMissionFiveOutcome(snapshot({ inventory: ['generator'] })).tier).toBe('medium');
    expect(calculateMissionFiveOutcome(snapshot({ inventory: ['medkit'] })).tier).toBe('poor');
  });

  it('uses the frozen scenario key as deterministic difficulty without post-open randomness', () => {
    const severeScenario = 'route_00000000000e';
    expect(calculateMissionFiveOutcome(snapshot({
      scenarioKey: severeScenario,
      committedAbilityKeys: ['route_analysis'],
    })).tier).toBe('poor');
    expect(calculateMissionFiveOutcome(snapshot({
      scenarioKey: severeScenario,
      committedAbilityKeys: ['route_analysis','mechanical_fix'],
    })).tier).toBe('medium');
    expect(calculateMissionFiveOutcome(snapshot({
      scenarioKey: severeScenario,
      committedAbilityKeys: ['route_analysis','mechanical_fix','physical_task'],
    })).tier).toBe('best');
  });
});
