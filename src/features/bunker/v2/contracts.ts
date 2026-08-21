export const BUNKER_V2_GLOBAL_STATES = [
  'LOBBY',
  'CHARACTERS_READY',
  'MISSION_01',
  'BREAK',
  'MISSION_02',
  'MISSION_03',
  'MISSION_04',
  'MISSION_05',
  'MISSION_06',
  'UNKNOWN_PASSENGER',
  'BREAK_BEFORE_FINAL',
  'FINAL_30',
  'BUNKER_OPEN',
  'FINISHED',
] as const;

export type BunkerV2GlobalState = typeof BUNKER_V2_GLOBAL_STATES[number];

export const BUNKER_V2_MISSION_CODES = [
  'MISSION_01',
  'MISSION_02',
  'MISSION_03',
  'MISSION_04',
  'MISSION_05',
  'MISSION_06',
  'UNKNOWN_PASSENGER',
  'FINAL_30',
] as const;

export type BunkerV2MissionCode = typeof BUNKER_V2_MISSION_CODES[number];

export type BunkerV2State = {
  contractVersion: 2;
  state: BunkerV2GlobalState;
};

export type BunkerCommand =
  | {
      type: 'mission_confirm';
      payload: { instanceId: string; instanceVersion: number; selection: string[] };
    }
  | { type: 'submit_answer'; payload: { instanceId: string; answers: string[] } }
  | { type: 'use_ability'; payload: { instanceId: string; problemKey: string } }
  | { type: 'send_message'; payload: { instanceId: string; message: string } }
  | {
      type: 'propose_trade';
      payload: {
        instanceId: string;
        targetWagonNumber: number;
        itemKey: string;
        quantity: number;
      };
    }
  | {
      type: 'respond_trade';
      payload: { instanceId: string; transferId: string; response: 'accept' | 'reject' };
    }
  | { type: 'cast_vote'; payload: { instanceId: string; vote: string } }
  | { type: 'reveal_fragment'; payload: { instanceId: string; fragmentKey: string } }
  | {
      type: 'request_access';
      payload: {
        coordinates: string;
        sector: string;
        accessCode: string;
        gateTime: string;
        password: string;
      };
    };

export type BunkerCommandType = BunkerCommand['type'];

export type BunkerCommandReceipt = {
  contractVersion: 2;
  status: 'accepted';
  commandId: string;
  commandType: BunkerCommandType;
};

type BunkerV2CharacterBase = {
  profileKey: string;
  profileVersion: number;
  profession: string;
  health: string;
  visibleSkill: string;
  specialAbility: string;
  abilityDescription: string;
  abilityUsesRemaining: number;
  status: 'active' | 'saved' | 'excluded';
  m01Eligibility: 'frozen_member' | 'late_joiner';
};

export type BunkerV2Character =
  | (BunkerV2CharacterBase & { hiddenTraitRevealed: false })
  | (BunkerV2CharacterBase & { hiddenTraitRevealed: true; hiddenTrait: string });

export type BunkerV2CurrentMission = {
  instanceId: string;
  instanceVersion: number;
  code: BunkerV2MissionCode;
  status: 'planned' | 'active' | 'completed';
  scope: 'wagon' | 'group' | 'global';
};

export type BunkerV2InactiveRuntime = {
  contractVersion: 2;
  status: 'idle' | 'not_found' | 'guest_not_found';
  serverNow: string;
};

type BunkerV2ActiveRuntimeBase = {
  contractVersion: 2;
  status: 'active';
  serverNow: string;
  state: BunkerV2GlobalState;
  planVersion: number;
  runNonce: string;
  currentMission: BunkerV2CurrentMission | null;
};

export type BunkerV2ActiveOwnerRuntime = BunkerV2ActiveRuntimeBase & {
  viewer: { kind: 'owner' };
};

export type BunkerV2ActiveGuestRuntime = BunkerV2ActiveRuntimeBase & {
      viewer: {
        kind: 'guest';
        guest: { id: string; realName: string };
        wagon: { number: number; label: string };
      };
      character: BunkerV2Character;
    };

export type BunkerV2GuestRuntime = BunkerV2InactiveRuntime | BunkerV2ActiveGuestRuntime;
export type BunkerV2OwnerRuntime = BunkerV2InactiveRuntime | BunkerV2ActiveOwnerRuntime;
export type BunkerV2Runtime = BunkerV2GuestRuntime | BunkerV2OwnerRuntime;

const V2_STATES = new Set<string>(BUNKER_V2_GLOBAL_STATES);
const V2_MISSION_CODES = new Set<string>(BUNKER_V2_MISSION_CODES);
const COMMAND_TYPES = new Set<string>([
  'mission_confirm',
  'submit_answer',
  'use_ability',
  'send_message',
  'propose_trade',
  'respond_trade',
  'cast_vote',
  'reveal_fragment',
  'request_access',
]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value as Record<string, unknown>;
}

function exactObject(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  const parsed = object(value, label);
  const actual = Object.keys(parsed);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`Unexpected Bunker V2 ${label} key`);
  }
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected Bunker V2 ${label}`);
  }
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Unexpected Bunker V2 timestamp');
  }
  return value;
}

function textArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Unexpected Bunker V2 ${label}`);
  return value.map((entry) => text(entry, label));
}

function globalState(value: unknown): BunkerV2GlobalState {
  if (typeof value !== 'string' || !V2_STATES.has(value)) {
    throw new Error('Unexpected Bunker V2 state');
  }
  return value as BunkerV2GlobalState;
}

function missionCode(value: unknown): BunkerV2MissionCode {
  if (typeof value !== 'string' || !V2_MISSION_CODES.has(value)) {
    throw new Error('Unexpected Bunker V2 mission code');
  }
  return value as BunkerV2MissionCode;
}

function commandType(value: unknown): BunkerCommandType {
  if (typeof value !== 'string' || !COMMAND_TYPES.has(value)) {
    throw new Error('Unexpected Bunker V2 command type');
  }
  return value as BunkerCommandType;
}

export function parseBunkerV2State(value: unknown): BunkerV2State {
  const state = exactObject(value, ['contractVersion', 'state'], 'state');
  if (state.contractVersion !== 2) throw new Error('Unexpected Bunker V2 contract version');
  return { contractVersion: 2, state: globalState(state.state) };
}

export function parseBunkerCommand(value: unknown): BunkerCommand {
  const command = exactObject(value, ['type', 'payload'], 'command');
  const type = commandType(command.type);

  switch (type) {
    case 'mission_confirm': {
      const payload = exactObject(
        command.payload,
        ['instanceId', 'instanceVersion', 'selection'],
        'mission_confirm payload',
      );
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          instanceVersion: positiveInteger(payload.instanceVersion, 'instance version'),
          selection: textArray(payload.selection, 'selection'),
        },
      };
    }
    case 'submit_answer': {
      const payload = exactObject(command.payload, ['instanceId', 'answers'], 'submit_answer payload');
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          answers: textArray(payload.answers, 'answers'),
        },
      };
    }
    case 'use_ability': {
      const payload = exactObject(command.payload, ['instanceId', 'problemKey'], 'use_ability payload');
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          problemKey: text(payload.problemKey, 'problem key'),
        },
      };
    }
    case 'send_message': {
      const payload = exactObject(command.payload, ['instanceId', 'message'], 'send_message payload');
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          message: text(payload.message, 'message'),
        },
      };
    }
    case 'propose_trade': {
      const payload = exactObject(
        command.payload,
        ['instanceId', 'targetWagonNumber', 'itemKey', 'quantity'],
        'propose_trade payload',
      );
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          targetWagonNumber: positiveInteger(payload.targetWagonNumber, 'target wagon number'),
          itemKey: text(payload.itemKey, 'item key'),
          quantity: positiveInteger(payload.quantity, 'quantity'),
        },
      };
    }
    case 'respond_trade': {
      const payload = exactObject(
        command.payload,
        ['instanceId', 'transferId', 'response'],
        'respond_trade payload',
      );
      if (payload.response !== 'accept' && payload.response !== 'reject') {
        throw new Error('Unexpected Bunker V2 trade response');
      }
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          transferId: text(payload.transferId, 'transfer id'),
          response: payload.response,
        },
      };
    }
    case 'cast_vote': {
      const payload = exactObject(command.payload, ['instanceId', 'vote'], 'cast_vote payload');
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          vote: text(payload.vote, 'vote'),
        },
      };
    }
    case 'reveal_fragment': {
      const payload = exactObject(
        command.payload,
        ['instanceId', 'fragmentKey'],
        'reveal_fragment payload',
      );
      return {
        type,
        payload: {
          instanceId: text(payload.instanceId, 'instance id'),
          fragmentKey: text(payload.fragmentKey, 'fragment key'),
        },
      };
    }
    case 'request_access': {
      const payload = exactObject(
        command.payload,
        ['coordinates', 'sector', 'accessCode', 'gateTime', 'password'],
        'request_access payload',
      );
      return {
        type,
        payload: {
          coordinates: text(payload.coordinates, 'coordinates'),
          sector: text(payload.sector, 'sector'),
          accessCode: text(payload.accessCode, 'access code'),
          gateTime: text(payload.gateTime, 'gate time'),
          password: text(payload.password, 'password'),
        },
      };
    }
  }
}

export function parseBunkerCommandReceipt(value: unknown): BunkerCommandReceipt {
  const receipt = exactObject(
    value,
    ['contractVersion', 'status', 'commandId', 'commandType'],
    'command receipt',
  );
  if (receipt.contractVersion !== 2) throw new Error('Unexpected Bunker V2 contract version');
  if (receipt.status !== 'accepted') throw new Error('Unexpected Bunker V2 receipt status');
  return {
    contractVersion: 2,
    status: 'accepted',
    commandId: text(receipt.commandId, 'receipt command id'),
    commandType: commandType(receipt.commandType),
  };
}

function parseCharacter(value: unknown): BunkerV2Character {
  const input = object(value, 'character');
  if (input.hiddenTraitRevealed === false) {
    const character = exactObject(value, [
      'profileKey', 'profileVersion', 'profession', 'health', 'visibleSkill',
      'specialAbility', 'abilityDescription', 'abilityUsesRemaining', 'status',
      'm01Eligibility', 'hiddenTraitRevealed',
    ], 'character');
    return {
      ...parseCharacterBase(character),
      hiddenTraitRevealed: false,
    };
  }
  if (input.hiddenTraitRevealed === true) {
    const character = exactObject(value, [
      'profileKey', 'profileVersion', 'profession', 'health', 'visibleSkill',
      'specialAbility', 'abilityDescription', 'abilityUsesRemaining', 'status',
      'm01Eligibility', 'hiddenTraitRevealed', 'hiddenTrait',
    ], 'character');
    return {
      ...parseCharacterBase(character),
      hiddenTraitRevealed: true,
      hiddenTrait: text(character.hiddenTrait, 'hidden trait'),
    };
  }
  throw new Error('Unexpected Bunker V2 hidden trait visibility');
}

function parseCharacterBase(value: Record<string, unknown>): BunkerV2CharacterBase {
  if (value.status !== 'active' && value.status !== 'saved' && value.status !== 'excluded') {
    throw new Error('Unexpected Bunker V2 character status');
  }
  if (value.m01Eligibility !== 'frozen_member' && value.m01Eligibility !== 'late_joiner') {
    throw new Error('Unexpected Bunker V2 M01 eligibility');
  }
  return {
    profileKey: text(value.profileKey, 'profile key'),
    profileVersion: positiveInteger(value.profileVersion, 'profile version'),
    profession: text(value.profession, 'profession'),
    health: text(value.health, 'health'),
    visibleSkill: text(value.visibleSkill, 'visible skill'),
    specialAbility: text(value.specialAbility, 'special ability'),
    abilityDescription: text(value.abilityDescription, 'ability description'),
    abilityUsesRemaining: nonNegativeInteger(value.abilityUsesRemaining, 'ability uses remaining'),
    status: value.status,
    m01Eligibility: value.m01Eligibility,
  };
}

function parseCurrentMission(value: unknown): BunkerV2CurrentMission | null {
  if (value === null) return null;
  const mission = exactObject(value, [
    'instanceId', 'instanceVersion', 'code', 'status', 'scope',
  ], 'current mission');
  if (mission.status !== 'planned' && mission.status !== 'active' && mission.status !== 'completed') {
    throw new Error('Unexpected Bunker V2 mission status');
  }
  if (mission.scope !== 'wagon' && mission.scope !== 'group' && mission.scope !== 'global') {
    throw new Error('Unexpected Bunker V2 mission scope');
  }
  return {
    instanceId: text(mission.instanceId, 'mission instance id'),
    instanceVersion: positiveInteger(mission.instanceVersion, 'mission instance version'),
    code: missionCode(mission.code),
    status: mission.status,
    scope: mission.scope,
  };
}

export function parseBunkerV2Runtime(value: unknown): BunkerV2Runtime {
  const input = object(value, 'runtime');
  if (input.contractVersion !== 2) throw new Error('Unexpected Bunker V2 contract version');
  const status = input.status;
  if (status === 'idle' || status === 'not_found' || status === 'guest_not_found') {
    const runtime = exactObject(value, ['contractVersion', 'status', 'serverNow'], 'runtime');
    return { contractVersion: 2, status, serverNow: timestamp(runtime.serverNow) };
  }
  if (status !== 'active') throw new Error('Unexpected Bunker V2 runtime status');

  const viewerInput = object(input.viewer, 'viewer');
  const state = globalState(input.state);
  const currentMission = parseCurrentMission(input.currentMission);
  const requiresCurrentMission = V2_MISSION_CODES.has(state);
  if (requiresCurrentMission && currentMission === null) {
    throw new Error('Unexpected Bunker V2 current mission');
  }
  if (!requiresCurrentMission && currentMission !== null) {
    throw new Error('Unexpected Bunker V2 current mission');
  }
  if (currentMission !== null && currentMission.code !== state) {
    throw new Error('Unexpected Bunker V2 mission state');
  }
  const common = {
    contractVersion: 2 as const,
    status: 'active' as const,
    serverNow: timestamp(input.serverNow),
    state,
    planVersion: positiveInteger(input.planVersion, 'plan version'),
    runNonce: text(input.runNonce, 'run nonce'),
    currentMission,
  };
  if (viewerInput.kind === 'owner') {
    exactObject(value, [
      'contractVersion', 'status', 'serverNow', 'state', 'planVersion', 'runNonce',
      'viewer', 'currentMission',
    ], 'runtime');
    exactObject(input.viewer, ['kind'], 'owner viewer');
    return { ...common, viewer: { kind: 'owner' } };
  }
  if (viewerInput.kind === 'guest') {
    exactObject(value, [
      'contractVersion', 'status', 'serverNow', 'state', 'planVersion', 'runNonce',
      'viewer', 'character', 'currentMission',
    ], 'runtime');
    const viewer = exactObject(input.viewer, ['kind', 'guest', 'wagon'], 'guest viewer');
    const guest = exactObject(viewer.guest, ['id', 'realName'], 'guest identity');
    const wagon = exactObject(viewer.wagon, ['number', 'label'], 'guest wagon');
    return {
      ...common,
      viewer: {
        kind: 'guest',
        guest: {
          id: text(guest.id, 'guest id'),
          realName: text(guest.realName, 'guest real name'),
        },
        wagon: {
          number: positiveInteger(wagon.number, 'wagon number'),
          label: text(wagon.label, 'wagon label'),
        },
      },
      character: parseCharacter(input.character),
    };
  }
  throw new Error('Unexpected Bunker V2 viewer kind');
}

export function parseBunkerV2GuestRuntime(value: unknown): BunkerV2GuestRuntime {
  const runtime = parseBunkerV2Runtime(value);
  if (runtime.status === 'active' && !('character' in runtime)) {
    throw new Error('Unexpected Bunker V2 guest viewer');
  }
  return runtime;
}

export function parseBunkerV2OwnerRuntime(value: unknown): BunkerV2OwnerRuntime {
  const runtime = parseBunkerV2Runtime(value);
  if (runtime.status === 'active' && 'character' in runtime) {
    throw new Error('Unexpected Bunker V2 owner viewer');
  }
  return runtime;
}
