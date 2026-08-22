export type MissionFiveOutcomeChoice = 'A' | 'B';
export type MissionFiveOutcomeTier = 'best' | 'medium' | 'poor' | 'safe';

export type MissionFiveOutcomeSnapshot = {
  choice: MissionFiveOutcomeChoice;
  scenarioKey: string;
  inventory: readonly string[];
  savedProfileKeys: readonly string[];
  committedAbilityKeys: readonly string[];
  fallback: boolean;
};

export type MissionFiveCalculatedOutcome = {
  routeChoice: MissionFiveOutcomeChoice;
  routeBonusMinutes: number;
  trackDamage: number;
  powerInstability: number;
  sector04Found: boolean;
  fallback: boolean;
  tier: MissionFiveOutcomeTier;
};

const NAVIGATION_PROFILES = new Set(['train_driver','geologist','cartographer','driver']);
const TECHNICAL_PROFILES = new Set(['power_engineer','electrician','mechanic','military_engineer','builder']);
const PROTECTION_PROFILES = new Set(['rescuer','firefighter','climber','athlete']);

const NAVIGATION_ABILITIES = new Set(['route_analysis','terrain_analysis','route_feel','map_reconstruction']);
const TECHNICAL_ABILITIES = new Set(['mechanical_fix','power_restore','power_bypass','structure_analysis']);
const PROTECTION_ABILITIES = new Set(['dangerous_route','physical_task']);

function hasAny(values: readonly string[], accepted: ReadonlySet<string>): boolean {
  return values.some((value) => accepted.has(value));
}

function scenarioDifficulty(scenarioKey: string): 'low' | 'medium' | 'high' {
  const match = /^route_[0-9a-f]{12}$/i.exec(scenarioKey.trim());
  if (!match) throw new Error('Unexpected M05 scenario key');
  const lastNibble = Number.parseInt(scenarioKey.at(-1)!, 16);
  const band = lastNibble % 3;
  return band === 0 ? 'low' : band === 1 ? 'medium' : 'high';
}

function supportCount(snapshot: MissionFiveOutcomeSnapshot): number {
  const navigation = hasAny(snapshot.savedProfileKeys, NAVIGATION_PROFILES)
    || hasAny(snapshot.committedAbilityKeys, NAVIGATION_ABILITIES);
  const technical = snapshot.inventory.some((item) => item === 'tools' || item === 'generator')
    || hasAny(snapshot.savedProfileKeys, TECHNICAL_PROFILES)
    || hasAny(snapshot.committedAbilityKeys, TECHNICAL_ABILITIES);
  const protection = snapshot.inventory.includes('gas_mask')
    || hasAny(snapshot.savedProfileKeys, PROTECTION_PROFILES)
    || hasAny(snapshot.committedAbilityKeys, PROTECTION_ABILITIES);
  return Number(navigation) + Number(technical) + Number(protection);
}

export function calculateMissionFiveOutcome(snapshot: MissionFiveOutcomeSnapshot): MissionFiveCalculatedOutcome {
  scenarioDifficulty(snapshot.scenarioKey);
  if (snapshot.choice === 'B') {
    return {
      routeChoice: 'B',
      routeBonusMinutes: -5,
      trackDamage: 0,
      powerInstability: 0,
      sector04Found: false,
      fallback: snapshot.fallback,
      tier: 'safe',
    };
  }
  if (snapshot.choice !== 'A') throw new Error('Unexpected M05 route choice');

  const difficulty = scenarioDifficulty(snapshot.scenarioKey);
  const support = supportCount(snapshot);
  const bestRequired = difficulty === 'low' ? 2 : 3;
  const mediumRequired = difficulty === 'high' ? 2 : 1;

  if (support >= bestRequired) {
    return {
      routeChoice: 'A',
      routeBonusMinutes: 7,
      trackDamage: 0,
      powerInstability: 0,
      sector04Found: true,
      fallback: snapshot.fallback,
      tier: 'best',
    };
  }
  if (support >= mediumRequired) {
    return {
      routeChoice: 'A',
      routeBonusMinutes: 4,
      trackDamage: 0,
      powerInstability: 1,
      sector04Found: false,
      fallback: snapshot.fallback,
      tier: 'medium',
    };
  }
  return {
    routeChoice: 'A',
    routeBonusMinutes: 0,
    trackDamage: 20,
    powerInstability: 0,
    sector04Found: false,
    fallback: snapshot.fallback,
    tier: 'poor',
  };
}
