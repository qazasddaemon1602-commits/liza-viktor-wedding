import { throwBunkerV2RpcError, type BunkerV2RpcClient } from './command.service';

export type BunkerV2DashboardPassengerBase = {
  guestId: string;
  realName: string;
  profession: string;
  visibleSkill: string;
  characterStatus: 'active' | 'saved' | 'excluded';
};

export type BunkerV2DashboardPassenger =
  | (BunkerV2DashboardPassengerBase & { hiddenTraitRevealed: false })
  | (BunkerV2DashboardPassengerBase & { hiddenTraitRevealed: true; hiddenTrait: string });

export type BunkerV2DashboardInventoryItem = {
  itemKey: string;
  available: number;
  used: number;
  transferred: number;
  lost: number;
};

export type BunkerV2DashboardArchiveEntry = {
  artifactKey: string;
  contentType: 'text' | 'image' | 'map' | 'audio' | 'document' | 'code';
  decryptionStatus: 'locked' | 'partial' | 'decoded';
  scope: 'wagon' | 'global';
};

export type BunkerV2DashboardWagonState = {
  powerStatus: 'stable' | 'unstable' | 'offline';
  communicationStatus: 'working' | 'degraded' | 'offline';
  navigationStatus: 'working' | 'degraded' | 'offline';
  technicalDoorStatus: 'locked' | 'unlocked' | 'damaged';
  trackDamage: number;
  waterStatus: 'stable' | 'limited' | 'contaminated' | 'empty';
  routeChoice: 'A' | 'B' | null;
  routeBonus: number;
  powerInstability: number;
  sector04Found: boolean;
  coordinationBonus: boolean;
};

export type BunkerV2DashboardReadModel =
  | { contractVersion: 2; status: 'idle' | 'not_found' | 'legacy'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active';
      serverNow: string;
      wagon: { id: string; number: number; label: string };
      passengers: BunkerV2DashboardPassenger[];
      inventory: BunkerV2DashboardInventoryItem[];
      archive: BunkerV2DashboardArchiveEntry[];
      wagonState: BunkerV2DashboardWagonState;
    };

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected Bunker dashboard ${label}`);
  }
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const parsed = record(value, label);
  const actual = Object.keys(parsed);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`Unexpected Bunker dashboard ${label}`);
  }
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Unexpected Bunker dashboard ${label}`);
  return value;
}

function timestamp(value: unknown): string {
  const parsed = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(parsed))) throw new Error('Unexpected Bunker dashboard timestamp');
  return parsed;
}

function integer(value: unknown, label: string, nonNegative = true): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || (nonNegative && value < 0)) {
    throw new Error(`Unexpected Bunker dashboard ${label}`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected Bunker dashboard ${label}`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`Unexpected Bunker dashboard ${label}`);
  }
  return value as T;
}

function parsePassenger(value: unknown): BunkerV2DashboardPassenger {
  const input = record(value, 'passenger');
  const revealed = boolean(input.hiddenTraitRevealed, 'hidden trait visibility');
  const keys = revealed
    ? ['guestId','realName','profession','visibleSkill','characterStatus','hiddenTraitRevealed','hiddenTrait'] as const
    : ['guestId','realName','profession','visibleSkill','characterStatus','hiddenTraitRevealed'] as const;
  const passenger = exact(value, keys, 'passenger');
  const base: BunkerV2DashboardPassengerBase = {
    guestId: text(passenger.guestId, 'passenger id'),
    realName: text(passenger.realName, 'passenger name'),
    profession: text(passenger.profession, 'passenger profession'),
    visibleSkill: text(passenger.visibleSkill, 'passenger visible skill'),
    characterStatus: oneOf(passenger.characterStatus, ['active','saved','excluded'] as const, 'passenger status'),
  };
  if (revealed) {
    return { ...base, hiddenTraitRevealed: true, hiddenTrait: text(passenger.hiddenTrait, 'hidden trait') };
  }
  if ('hiddenTrait' in input) throw new Error('Unexpected Bunker dashboard hidden trait');
  return { ...base, hiddenTraitRevealed: false };
}

function parseInventory(value: unknown): BunkerV2DashboardInventoryItem {
  const item = exact(value, ['itemKey','available','used','transferred','lost'], 'inventory');
  return {
    itemKey: text(item.itemKey, 'inventory item key'),
    available: integer(item.available, 'inventory available'),
    used: integer(item.used, 'inventory used'),
    transferred: integer(item.transferred, 'inventory transferred'),
    lost: integer(item.lost, 'inventory lost'),
  };
}

function parseArchive(value: unknown): BunkerV2DashboardArchiveEntry {
  const entry = exact(value, ['artifactKey','contentType','decryptionStatus','scope'], 'archive');
  return {
    artifactKey: text(entry.artifactKey, 'archive key'),
    contentType: oneOf(entry.contentType, ['text','image','map','audio','document','code'] as const, 'archive content type'),
    decryptionStatus: oneOf(entry.decryptionStatus, ['locked','partial','decoded'] as const, 'archive status'),
    scope: oneOf(entry.scope, ['wagon','global'] as const, 'archive scope'),
  };
}

function parseRouteBonus(value: unknown, routeChoice: 'A' | 'B' | null): number {
  const bonus = integer(value, 'wagon state route bonus', false);
  if (![-5, 0, 4, 7].includes(bonus)) {
    throw new Error('Unexpected Bunker dashboard wagon state route bonus');
  }
  if (routeChoice === null && bonus !== 0) {
    throw new Error('Unexpected Bunker dashboard wagon state route bonus');
  }
  if (routeChoice === 'B' && bonus !== -5) {
    throw new Error('Unexpected Bunker dashboard wagon state route bonus');
  }
  if (routeChoice === 'A' && ![0, 4, 7].includes(bonus)) {
    throw new Error('Unexpected Bunker dashboard wagon state route bonus');
  }
  return bonus;
}

function parseWagonState(value: unknown): BunkerV2DashboardWagonState {
  const state = exact(value, [
    'powerStatus','communicationStatus','navigationStatus','technicalDoorStatus','trackDamage',
    'waterStatus','routeChoice','routeBonus','powerInstability','sector04Found','coordinationBonus',
  ], 'wagon state');
  if (state.routeChoice !== null && state.routeChoice !== 'A' && state.routeChoice !== 'B') {
    throw new Error('Unexpected Bunker dashboard wagon state route choice');
  }
  const routeChoice = state.routeChoice as 'A' | 'B' | null;
  return {
    powerStatus: oneOf(state.powerStatus, ['stable','unstable','offline'] as const, 'wagon state power'),
    communicationStatus: oneOf(state.communicationStatus, ['working','degraded','offline'] as const, 'wagon state communication'),
    navigationStatus: oneOf(state.navigationStatus, ['working','degraded','offline'] as const, 'wagon state navigation'),
    technicalDoorStatus: oneOf(state.technicalDoorStatus, ['locked','unlocked','damaged'] as const, 'wagon state technical door'),
    trackDamage: integer(state.trackDamage, 'wagon state track damage'),
    waterStatus: oneOf(state.waterStatus, ['stable','limited','contaminated','empty'] as const, 'wagon state water'),
    routeChoice,
    routeBonus: parseRouteBonus(state.routeBonus, routeChoice),
    powerInstability: integer(state.powerInstability, 'wagon state power instability'),
    sector04Found: boolean(state.sector04Found, 'wagon state sector discovery'),
    coordinationBonus: boolean(state.coordinationBonus, 'wagon state coordination bonus'),
  };
}

export function parseBunkerV2DashboardReadModel(value: unknown): BunkerV2DashboardReadModel {
  const input = record(value, 'read model');
  if (input.contractVersion !== 2 || typeof input.status !== 'string') {
    throw new Error('Unexpected Bunker dashboard read model');
  }
  if (input.status === 'idle' || input.status === 'not_found' || input.status === 'legacy') {
    const inactive = exact(value, ['contractVersion','status','serverNow'], 'read model');
    return {
      contractVersion: 2,
      status: inactive.status as 'idle' | 'not_found' | 'legacy',
      serverNow: timestamp(inactive.serverNow),
    };
  }
  if (input.status !== 'active') throw new Error('Unexpected Bunker dashboard status');
  const active = exact(value, [
    'contractVersion','status','serverNow','wagon','passengers','inventory','archive','wagonState',
  ], 'read model');
  const wagon = exact(active.wagon, ['id','number','label'], 'wagon');
  if (!Array.isArray(active.passengers) || !Array.isArray(active.inventory) || !Array.isArray(active.archive)) {
    throw new Error('Unexpected Bunker dashboard collections');
  }
  return {
    contractVersion: 2,
    status: 'active',
    serverNow: timestamp(active.serverNow),
    wagon: {
      id: text(wagon.id, 'wagon id'),
      number: integer(wagon.number, 'wagon number'),
      label: text(wagon.label, 'wagon label'),
    },
    passengers: active.passengers.map(parsePassenger),
    inventory: active.inventory.map(parseInventory),
    archive: active.archive.map(parseArchive),
    wagonState: parseWagonState(active.wagonState),
  };
}

export async function getGuestBunkerV2Dashboard(
  client: BunkerV2RpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<BunkerV2DashboardReadModel> {
  const { data, error } = await client.rpc('get_guest_bunker_v2_dashboard', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Bunker dashboard request failed');
  return parseBunkerV2DashboardReadModel(data);
}