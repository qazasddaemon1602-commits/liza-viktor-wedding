import {
  submitBunkerCommand,
  throwBunkerV2RpcError,
  type BunkerV2RpcClient,
} from './command.service';
import type { BunkerCommandReceipt } from './contracts';

export type MissionFourRpcClient = BunkerV2RpcClient;
export type MissionFourGuestReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      instanceId: string;
      instanceVersion: number;
      title: string;
      interactionPhase: 'exchange' | 'answer' | 'resolved';
      group: { key: string; wagons: Array<{ id: string; number: number; label: string }> };
      viewer: { wagonId: string; wagonNumber: number; isOperator: boolean };
      messageQuota: number;
      messagesRemaining: number;
      messages: Array<{
        id: string;
        fromWagonLabel: string;
        senderName: string;
        message: string;
        createdAt: string;
      }>;
      inventory: Array<{ itemKey: string; quantity: number }>;
      trades: Array<{
        id: string;
        direction: 'incoming' | 'outgoing';
        otherWagonLabel: string;
        itemKey: string;
        quantity: number;
        status: 'proposed' | 'accepted' | 'rejected' | 'expired';
      }>;
      answer: {
        options: string[];
        selected: string | null;
        answeredWagons: number;
        totalWagons: number;
      };
      ability: { available: boolean; key: string; label: string; hint: string } | null;
    };
export type MissionFourScreenReadModel =
  | { contractVersion: 2; status: 'idle' | 'legacy' | 'not_found'; serverNow: string }
  | {
      contractVersion: 2;
      status: 'active' | 'completed';
      serverNow: string;
      deadlineAt: string;
      title: string;
      groups: Array<{
        groupKey: string;
        labels: string[];
        phase: 'exchange' | 'answer' | 'resolved';
        answeredWagons: number;
        totalWagons: number;
        tradeCount: number;
      }>;
    };
export type MissionFourOwnerReadModel = MissionFourScreenReadModel;

type InteractionPhase = 'exchange' | 'answer' | 'resolved';
type TradeStatus = 'proposed' | 'accepted' | 'rejected' | 'expired';

function obj(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Unexpected mission four ${label}`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Unexpected mission four ${label}`);
  }
  return value;
}

function int(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Unexpected mission four ${label}`);
  }
  return value;
}

function positiveInt(value: unknown, label: string): number {
  const result = int(value, label);
  if (result < 1) throw new Error(`Unexpected mission four ${label}`);
  return result;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Unexpected mission four ${label}`);
  return value;
}

function time(value: unknown): string {
  const result = text(value, 'timestamp');
  if (!Number.isFinite(Date.parse(result))) throw new Error('Unexpected mission four timestamp');
  return result;
}

function phase(value: unknown, label: string): InteractionPhase {
  if (value !== 'exchange' && value !== 'answer' && value !== 'resolved') {
    throw new Error(`Unexpected mission four ${label}`);
  }
  return value;
}

function tradeStatus(value: unknown): TradeStatus {
  if (value !== 'proposed' && value !== 'accepted' && value !== 'rejected' && value !== 'expired') {
    throw new Error('Unexpected mission four trade status');
  }
  return value;
}

function parseAbility(value: unknown) {
  if (value === null) return null;
  const ability = obj(value, 'ability');
  return {
    available: bool(ability.available, 'ability available'),
    key: text(ability.key, 'ability key'),
    label: text(ability.label, 'ability label'),
    hint: text(ability.hint, 'ability hint'),
  };
}

export function parseMissionFourGuestReadModel(value: unknown): MissionFourGuestReadModel {
  const row = obj(value, 'read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission four read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission four status');
  }
  if (!Array.isArray(row.messages) || !Array.isArray(row.inventory) || !Array.isArray(row.trades)) {
    throw new Error('Unexpected mission four payload');
  }

  const group = obj(row.group, 'group');
  const viewer = obj(row.viewer, 'viewer');
  const answer = obj(row.answer, 'answer');
  if (!Array.isArray(group.wagons) || group.wagons.length < 2 || group.wagons.length > 5) {
    throw new Error('Unexpected mission four group');
  }
  if (!Array.isArray(answer.options) || answer.options.length < 1) {
    throw new Error('Unexpected mission four answer options');
  }

  const options = answer.options.map((entry) => text(entry, 'answer option'));
  if (new Set(options).size !== options.length) throw new Error('Unexpected mission four duplicate answer option');
  let selected: string | null = null;
  if (answer.selected !== null && answer.selected !== undefined) {
    selected = text(answer.selected, 'selected answer');
    if (!options.includes(selected)) throw new Error('Unexpected mission four selected answer');
  }

  return {
    contractVersion: 2,
    status: row.status,
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    instanceId: text(row.instanceId, 'instance'),
    instanceVersion: int(row.instanceVersion, 'version'),
    title: text(row.title, 'title'),
    interactionPhase: phase(row.interactionPhase, 'interaction phase'),
    group: {
      key: text(group.key, 'group key'),
      wagons: group.wagons.map((entry) => {
        const wagon = obj(entry, 'wagon');
        return {
          id: text(wagon.id, 'wagon id'),
          number: positiveInt(wagon.number, 'wagon number'),
          label: text(wagon.label, 'wagon label'),
        };
      }),
    },
    viewer: {
      wagonId: text(viewer.wagonId, 'viewer wagon'),
      wagonNumber: positiveInt(viewer.wagonNumber, 'viewer wagon number'),
      isOperator: bool(viewer.isOperator, 'viewer operator'),
    },
    messageQuota: positiveInt(row.messageQuota, 'quota'),
    messagesRemaining: int(row.messagesRemaining, 'remaining'),
    messages: row.messages.map((entry) => {
      const message = obj(entry, 'message');
      return {
        id: text(message.id, 'message id'),
        fromWagonLabel: text(message.fromWagonLabel, 'wagon label'),
        senderName: text(message.senderName, 'sender'),
        message: text(message.message, 'message'),
        createdAt: time(message.createdAt),
      };
    }),
    inventory: row.inventory.map((entry) => {
      const item = obj(entry, 'inventory');
      return {
        itemKey: text(item.itemKey, 'item'),
        quantity: positiveInt(item.quantity, 'quantity'),
      };
    }),
    trades: row.trades.map((entry) => {
      const trade = obj(entry, 'trade');
      if (trade.direction !== 'incoming' && trade.direction !== 'outgoing') {
        throw new Error('Unexpected mission four trade direction');
      }
      return {
        id: text(trade.id, 'trade id'),
        direction: trade.direction,
        otherWagonLabel: text(trade.otherWagonLabel, 'wagon label'),
        itemKey: text(trade.itemKey, 'item'),
        quantity: positiveInt(trade.quantity, 'quantity'),
        status: tradeStatus(trade.status),
      };
    }),
    answer: {
      options,
      selected,
      answeredWagons: int(answer.answeredWagons, 'answered'),
      totalWagons: positiveInt(answer.totalWagons, 'total'),
    },
    ability: parseAbility(row.ability),
  };
}

export function parseMissionFourScreenReadModel(value: unknown): MissionFourScreenReadModel {
  const row = obj(value, 'screen read model');
  if (row.contractVersion !== 2 || typeof row.status !== 'string') {
    throw new Error('Unexpected mission four screen read model');
  }
  if (row.status === 'idle' || row.status === 'legacy' || row.status === 'not_found') {
    return { contractVersion: 2, status: row.status, serverNow: time(row.serverNow) };
  }
  if (row.status !== 'active' && row.status !== 'completed') {
    throw new Error('Unexpected mission four screen status');
  }
  if (!Array.isArray(row.groups)) throw new Error('Unexpected mission four screen groups');

  return {
    contractVersion: 2,
    status: row.status,
    serverNow: time(row.serverNow),
    deadlineAt: time(row.deadlineAt),
    title: text(row.title, 'screen title'),
    groups: row.groups.map((entry) => {
      const group = obj(entry, 'screen group');
      if (!Array.isArray(group.labels) || group.labels.length < 2 || group.labels.length > 5) {
        throw new Error('Unexpected mission four group labels');
      }
      return {
        groupKey: text(group.groupKey, 'group key'),
        labels: group.labels.map((label) => text(label, 'group label')),
        phase: phase(group.phase, 'group phase'),
        answeredWagons: int(group.answeredWagons, 'answered wagons'),
        totalWagons: positiveInt(group.totalWagons, 'total wagons'),
        tradeCount: int(group.tradeCount, 'trade count'),
      };
    }),
  };
}

export async function getGuestMissionFourReadModel(
  client: MissionFourRpcClient,
  eventSlug: string,
  deviceKey: string,
) {
  const { data, error } = await client.rpc('get_guest_bunker_v2_m04', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwBunkerV2RpcError(error, 'Mission four read failed');
  return parseMissionFourGuestReadModel(data);
}

export async function getMissionFourScreenReadModel(
  client: MissionFourRpcClient,
  eventSlug: string,
) {
  const { data, error } = await client.rpc('get_bunker_v2_m04_screen', { p_event_slug: eventSlug });
  if (error) throwBunkerV2RpcError(error, 'Mission four screen failed');
  return parseMissionFourScreenReadModel(data);
}

export async function getOwnerMissionFourReadModel(
  client: MissionFourRpcClient,
  eventId: string,
) {
  const { data, error } = await client.rpc('get_owner_bunker_v2_m04', { p_event_id: eventId });
  if (error) throwBunkerV2RpcError(error, 'Mission four owner failed');
  return parseMissionFourScreenReadModel(data);
}

export function sendMissionFourMessage(
  client: MissionFourRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; message: string },
): Promise<BunkerCommandReceipt> {
  const message = input.message.trim();
  if (!message) return Promise.reject(new Error('Message is empty'));
  if (message.length > 120) {
    return Promise.reject(new Error('Mission four message must be at most 120 characters'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'send_message',
    payload: { instanceId: input.instanceId, message },
  });
}

export function proposeMissionFourTrade(
  client: MissionFourRpcClient,
  input: {
    eventSlug: string;
    deviceKey: string;
    commandId: string;
    instanceId: string;
    targetWagonNumber: number;
    itemKey: string;
    quantity: number;
  },
): Promise<BunkerCommandReceipt> {
  if (!Number.isInteger(input.targetWagonNumber) || input.targetWagonNumber < 1) {
    return Promise.reject(new Error('Mission four target wagon is invalid'));
  }
  if (!input.itemKey.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) {
    return Promise.reject(new Error('Mission four trade item is invalid'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'propose_trade',
    payload: {
      instanceId: input.instanceId,
      targetWagonNumber: input.targetWagonNumber,
      itemKey: input.itemKey,
      quantity: input.quantity,
    },
  });
}

export function respondMissionFourTrade(
  client: MissionFourRpcClient,
  input: {
    eventSlug: string;
    deviceKey: string;
    commandId: string;
    instanceId: string;
    transferId: string;
    response: 'accept' | 'reject';
  },
): Promise<BunkerCommandReceipt> {
  if (!input.transferId.trim() || (input.response !== 'accept' && input.response !== 'reject')) {
    return Promise.reject(new Error('Mission four trade response is invalid'));
  }
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'respond_trade',
    payload: {
      instanceId: input.instanceId,
      transferId: input.transferId,
      response: input.response,
    },
  });
}

export function submitMissionFourAnswer(
  client: MissionFourRpcClient,
  input: { eventSlug: string; deviceKey: string; commandId: string; instanceId: string; answer: string },
): Promise<BunkerCommandReceipt> {
  const answer = input.answer.trim();
  if (!answer) return Promise.reject(new Error('Mission four answer is empty'));
  return submitBunkerCommand(client, input.eventSlug, input.deviceKey, input.commandId, {
    type: 'submit_answer',
    payload: { instanceId: input.instanceId, answers: [answer] },
  });
}
