import {
  parseBunkerV2GuestRuntime,
  type BunkerCommandReceipt,
  type BunkerV2ActiveGuestRuntime,
  type BunkerV2CurrentMission,
} from './contracts';
import {
  submitBunkerCommand,
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';

export type MissionOneRpcClient = BunkerV2RpcClient;

export type MissionOneGuestRuntime = BunkerV2ActiveGuestRuntime & {
  state: 'MISSION_01';
  currentMission: BunkerV2CurrentMission & {
    code: 'MISSION_01';
    scope: 'wagon';
  };
};

export type ConfirmMissionOneSelectionInput = {
  eventSlug: string;
  deviceKey: string;
  commandId: string;
  instanceId: string;
  instanceVersion: number;
  selectedGuestIds: readonly string[];
};

type MissionOneUnavailableStatus = 'idle' | 'not_found' | 'guest_not_found';

export type MissionOneUnavailableReadModel = {
  contractVersion: 2;
  status: MissionOneUnavailableStatus;
  serverNow: string;
};

export type MissionOneLegacyReadModel = {
  contractVersion: 1;
  status: 'legacy';
  serverNow: string;
};

export type MissionOneScreenUnavailableReadModel = {
  contractVersion: 2;
  status: 'idle' | 'not_found';
  serverNow: string;
};

export type MissionOneGuestMember = {
  guestId: string;
  realName: string;
  profession: string;
  health: string;
  visibleSkill: string;
};

export type MissionOneGuestReadModel = MissionOneUnavailableReadModel | {
  contractVersion: 2;
  status: 'active' | 'completed';
  serverNow: string;
  instanceId: string;
  instanceVersion: number;
  deadlineAt: string;
  wagon: { id: string; number: number; label: string };
  quota: number;
  members: MissionOneGuestMember[];
  selectedGuestIds: string[];
};

export type MissionOneOwnerWagonReadModel = {
  wagonId: string;
  instanceId: string;
  instanceVersion: number;
  label: string;
  quota: number;
  status: 'active' | 'completed';
  selectedGuestIds: string[];
  members: Array<{ guestId: string; realName: string; profession: string }>;
};

export type MissionOneOwnerReadModel =
  | MissionOneLegacyReadModel
  | MissionOneUnavailableReadModel
  | {
      contractVersion: 2;
      status: 'active';
      serverNow: string;
      deadlineAt: string;
      wagons: MissionOneOwnerWagonReadModel[];
    };

export type MissionOneScreenReadModel =
  | MissionOneLegacyReadModel
  | MissionOneScreenUnavailableReadModel
  | {
      contractVersion: 2;
      status: 'active';
      serverNow: string;
      deadlineAt: string;
      title: string;
      publicSummary: string;
      wagons: Array<{
        wagonId: string;
        label: string;
        status: 'active' | 'completed';
      }>;
    };

export type OverrideMissionOneSelectionInput = {
  eventId: string;
  instanceId: string;
  instanceVersion: number;
  commandId: string;
  selectedGuestIds: readonly string[];
  reason: string;
};

export type OverrideMissionOneReceipt = {
  contractVersion: 2;
  status: 'accepted';
  commandId: string;
  commandType: 'owner_m01_override';
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Unexpected M01 ${label}`);
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
    throw new Error(`Unexpected M01 ${label}`);
  }
  return parsed;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Unexpected M01 ${label}`);
  return value;
}

function integer(value: unknown, label: string, allowZero = false): number {
  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || (allowZero ? value < 0 : value < 1)
  ) throw new Error(`Unexpected M01 ${label}`);
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error('Unexpected M01 timestamp');
  }
  return value;
}

function selectedIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('Unexpected M01 selection');
  return value.map((entry) => text(entry, 'selected guest id'));
}

function unavailable(value: unknown): MissionOneUnavailableReadModel | null {
  const input = object(value, 'read model');
  if (input.contractVersion !== 2) return null;
  if (input.status !== 'idle' && input.status !== 'not_found' && input.status !== 'guest_not_found') {
    return null;
  }
  const parsed = exactObject(value, ['contractVersion', 'status', 'serverNow'], 'read model');
  return {
    contractVersion: 2,
    status: parsed.status as MissionOneUnavailableStatus,
    serverNow: timestamp(parsed.serverNow),
  };
}

async function readRpc<T>(
  client: MissionOneRpcClient,
  name: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwBunkerV2RpcError(error, 'M01 read request failed');
  return parse(data);
}

function parseGuestMember(value: unknown): MissionOneGuestMember {
  const member = exactObject(
    value,
    ['guestId', 'realName', 'profession', 'health', 'visibleSkill'],
    'guest member',
  );
  return {
    guestId: text(member.guestId, 'guest id'),
    realName: text(member.realName, 'registered name'),
    profession: text(member.profession, 'profession'),
    health: text(member.health, 'health'),
    visibleSkill: text(member.visibleSkill, 'visible skill'),
  };
}

export function parseMissionOneGuestReadModel(value: unknown): MissionOneGuestReadModel {
  const inactive = unavailable(value);
  if (inactive) return inactive;
  const model = exactObject(value, [
    'contractVersion', 'status', 'serverNow', 'instanceId', 'instanceVersion',
    'deadlineAt', 'wagon', 'quota', 'members', 'selectedGuestIds',
  ], 'guest read model');
  if (model.contractVersion !== 2 || (model.status !== 'active' && model.status !== 'completed')) {
    throw new Error('Unexpected M01 guest status');
  }
  const wagon = exactObject(model.wagon, ['id', 'number', 'label'], 'guest wagon');
  if (!Array.isArray(model.members)) throw new Error('Unexpected M01 guest members');
  return {
    contractVersion: 2,
    status: model.status,
    serverNow: timestamp(model.serverNow),
    instanceId: text(model.instanceId, 'instance id'),
    instanceVersion: integer(model.instanceVersion, 'instance version'),
    deadlineAt: timestamp(model.deadlineAt),
    wagon: {
      id: text(wagon.id, 'wagon id'),
      number: integer(wagon.number, 'wagon number'),
      label: text(wagon.label, 'wagon label'),
    },
    quota: integer(model.quota, 'quota', true),
    members: model.members.map(parseGuestMember),
    selectedGuestIds: selectedIds(model.selectedGuestIds),
  };
}

function parseOwnerWagon(value: unknown): MissionOneOwnerWagonReadModel {
  const wagon = exactObject(value, [
    'wagonId', 'instanceId', 'instanceVersion', 'label', 'quota', 'status',
    'selectedGuestIds', 'members',
  ], 'owner wagon');
  if (wagon.status !== 'active' && wagon.status !== 'completed') {
    throw new Error('Unexpected M01 owner wagon status');
  }
  if (!Array.isArray(wagon.members)) throw new Error('Unexpected M01 owner members');
  return {
    wagonId: text(wagon.wagonId, 'owner wagon id'),
    instanceId: text(wagon.instanceId, 'owner instance id'),
    instanceVersion: integer(wagon.instanceVersion, 'owner instance version'),
    label: text(wagon.label, 'owner wagon label'),
    quota: integer(wagon.quota, 'owner quota', true),
    status: wagon.status,
    selectedGuestIds: selectedIds(wagon.selectedGuestIds),
    members: wagon.members.map((value) => {
      const member = exactObject(value, ['guestId', 'realName', 'profession'], 'owner member');
      return {
        guestId: text(member.guestId, 'owner guest id'),
        realName: text(member.realName, 'owner registered name'),
        profession: text(member.profession, 'owner profession'),
      };
    }),
  };
}

export function parseMissionOneOwnerReadModel(value: unknown): MissionOneOwnerReadModel {
  const input = object(value, 'owner read model');
  if (input.contractVersion === 1 && input.status === 'legacy') {
    const legacy = exactObject(value, ['contractVersion', 'status', 'serverNow'], 'legacy read model');
    return { contractVersion: 1, status: 'legacy', serverNow: timestamp(legacy.serverNow) };
  }
  const inactive = unavailable(value);
  if (inactive) return inactive;
  const model = exactObject(
    value,
    ['contractVersion', 'status', 'serverNow', 'deadlineAt', 'wagons'],
    'owner read model',
  );
  if (model.contractVersion !== 2 || model.status !== 'active' || !Array.isArray(model.wagons)) {
    throw new Error('Unexpected M01 owner read model');
  }
  return {
    contractVersion: 2,
    status: 'active',
    serverNow: timestamp(model.serverNow),
    deadlineAt: timestamp(model.deadlineAt),
    wagons: model.wagons.map(parseOwnerWagon),
  };
}

export function parseMissionOneScreenReadModel(value: unknown): MissionOneScreenReadModel {
  const input = object(value, 'public read model');
  if (input.contractVersion === 1 && input.status === 'legacy') {
    const legacy = exactObject(value, ['contractVersion', 'status', 'serverNow'], 'legacy read model');
    return { contractVersion: 1, status: 'legacy', serverNow: timestamp(legacy.serverNow) };
  }
  if (input.contractVersion === 2 && (input.status === 'idle' || input.status === 'not_found')) {
    const inactive = exactObject(
      value,
      ['contractVersion', 'status', 'serverNow'],
      'public read model',
    );
    return {
      contractVersion: 2,
      status: inactive.status as MissionOneScreenUnavailableReadModel['status'],
      serverNow: timestamp(inactive.serverNow),
    };
  }
  const model = exactObject(value, [
    'contractVersion', 'status', 'serverNow', 'deadlineAt', 'title',
    'publicSummary', 'wagons',
  ], 'public read model');
  if (model.contractVersion !== 2 || model.status !== 'active' || !Array.isArray(model.wagons)) {
    throw new Error('Unexpected M01 public read model');
  }
  return {
    contractVersion: 2,
    status: 'active',
    serverNow: timestamp(model.serverNow),
    deadlineAt: timestamp(model.deadlineAt),
    title: text(model.title, 'public title'),
    publicSummary: text(model.publicSummary, 'public summary'),
    wagons: model.wagons.map((value) => {
      const wagon = exactObject(value, ['wagonId', 'label', 'status'], 'public wagon');
      if (wagon.status !== 'active' && wagon.status !== 'completed') {
        throw new Error('Unexpected M01 public wagon status');
      }
      return {
        wagonId: text(wagon.wagonId, 'public wagon id'),
        label: text(wagon.label, 'public wagon label'),
        status: wagon.status,
      };
    }),
  };
}

export function getGuestMissionOneReadModel(
  client: MissionOneRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<MissionOneGuestReadModel> {
  return readRpc(client, 'get_guest_bunker_v2_m01', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  }, parseMissionOneGuestReadModel);
}

export function getOwnerMissionOneReadModel(
  client: MissionOneRpcClient,
  eventId: string,
): Promise<MissionOneOwnerReadModel> {
  return readRpc(client, 'get_owner_bunker_v2_m01', {
    p_event_id: eventId,
  }, parseMissionOneOwnerReadModel);
}

export function getMissionOneScreenReadModel(
  client: MissionOneRpcClient,
  eventSlug: string,
): Promise<MissionOneScreenReadModel> {
  return readRpc(client, 'get_bunker_v2_m01_screen', {
    p_event_slug: eventSlug,
  }, parseMissionOneScreenReadModel);
}

export function overrideMissionOneSelection(
  client: MissionOneRpcClient,
  input: OverrideMissionOneSelectionInput,
): Promise<OverrideMissionOneReceipt> {
  return readRpc(client, 'owner_override_bunker_v2_m01', {
    p_event_id: input.eventId,
    p_instance_id: input.instanceId,
    p_instance_version: input.instanceVersion,
    p_command_id: input.commandId,
    p_selected_guest_ids: [...input.selectedGuestIds],
    p_reason: input.reason,
  }, (value) => {
    const receipt = exactObject(
      value,
      ['contractVersion', 'status', 'commandId', 'commandType'],
      'owner override receipt',
    );
    if (
      receipt.contractVersion !== 2
      || receipt.status !== 'accepted'
      || receipt.commandType !== 'owner_m01_override'
    ) throw new Error('Unexpected M01 owner override receipt');
    return {
      contractVersion: 2,
      status: 'accepted',
      commandId: text(receipt.commandId, 'owner override command id'),
      commandType: 'owner_m01_override',
    };
  });
}

export function parseMissionOneGuestRuntime(value: unknown): MissionOneGuestRuntime {
  const runtime = parseBunkerV2GuestRuntime(value);
  if (
    runtime.status !== 'active'
    || runtime.state !== 'MISSION_01'
    || runtime.currentMission?.code !== 'MISSION_01'
    || runtime.currentMission.scope !== 'wagon'
  ) {
    throw new Error('Unexpected Bunker V2 mission one runtime');
  }
  return runtime as MissionOneGuestRuntime;
}

export async function confirmMissionOneSelection(
  client: MissionOneRpcClient,
  input: ConfirmMissionOneSelectionInput,
): Promise<BunkerCommandReceipt> {
  return submitBunkerCommand(
    client,
    input.eventSlug,
    input.deviceKey,
    input.commandId,
    {
      type: 'mission_confirm',
      payload: {
        instanceId: input.instanceId,
        instanceVersion: input.instanceVersion,
        selection: [...input.selectedGuestIds],
      },
    },
  );
}
