import { describe, expect, it, vi } from 'vitest';
import {
  getGuestMissionFourReadModel,
  getMissionFourScreenReadModel,
  parseMissionFourGuestReadModel,
  proposeMissionFourTrade,
  respondMissionFourTrade,
  sendMissionFourMessage,
  submitMissionFourAnswer,
} from './m04.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:30:00.000Z',
  deadlineAt: '2026-08-30T18:35:00.000Z',
  instanceId: '54000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  title: 'Межвагонная связь',
  interactionPhase: 'exchange',
  group: {
    key: 'group_1',
    wagons: [
      { id: 'w1', number: 1, label: 'ВАГОН №1' },
      { id: 'w2', number: 2, label: 'ВАГОН №2' },
    ],
  },
  viewer: { wagonId: 'w1', wagonNumber: 1, isOperator: true },
  messageQuota: 3,
  messagesRemaining: 3,
  messages: [],
  inventory: [{ itemKey: 'water', quantity: 2 }],
  trades: [],
  answer: {
    options: ['СВЯЗЬ', 'ПИТАНИЕ', 'МАРШРУТ'],
    selected: null,
    answeredWagons: 0,
    totalWagons: 2,
  },
  ability: null,
} as const;

const screenModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:30:00.000Z',
  deadlineAt: '2026-08-30T18:35:00.000Z',
  title: 'Межвагонная связь',
  groups: [
    {
      groupKey: 'group_1',
      labels: ['ВАГОН №1', 'ВАГОН №2'],
      phase: 'exchange',
      answeredWagons: 0,
      totalWagons: 2,
      tradeCount: 0,
    },
  ],
} as const;

describe('M04 service', () => {
  it('parses 2–5 wagon groups and message quota without technical ids in copy', async () => {
    const model = await getGuestMissionFourReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: active, error: null }) },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('active expected');
    expect(model.group.wagons).toHaveLength(2);
    expect(model.messagesRemaining).toBe(3);
  });

  it('rejects malformed phase, booleans, trade enums and answer state instead of coercing them', () => {
    expect(() => parseMissionFourGuestReadModel({ ...active, interactionPhase: 'waiting' })).toThrow(/interaction phase/i);
    expect(() => parseMissionFourGuestReadModel({
      ...active,
      viewer: { ...active.viewer, isOperator: 'false' },
    })).toThrow(/operator/i);
    expect(() => parseMissionFourGuestReadModel({
      ...active,
      trades: [{
        id: 'trade-1', direction: 'sideways', otherWagonLabel: 'ВАГОН №2',
        itemKey: 'water', quantity: 1, status: 'proposed',
      }],
    })).toThrow(/trade direction/i);
    expect(() => parseMissionFourGuestReadModel({
      ...active,
      answer: { ...active.answer, selected: 'НЕИЗВЕСТНО' },
    })).toThrow(/selected answer/i);
  });

  it('validates the common TV/owner projection at runtime', async () => {
    const valid = await getMissionFourScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: screenModel, error: null }) },
      'liza-viktor',
    );
    expect(valid).toEqual(screenModel);

    await expect(getMissionFourScreenReadModel(
      {
        rpc: vi.fn().mockResolvedValue({
          data: { ...screenModel, groups: [{ ...screenModel.groups[0], phase: 'waiting' }] },
          error: null,
        }),
      },
      'liza-viktor',
    )).rejects.toThrow(/group phase/i);
  });

  it('rejects messages over 120 characters before transport', async () => {
    const rpc = vi.fn();
    await expect(sendMissionFourMessage(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c',
        instanceId: active.instanceId, message: 'я'.repeat(121),
      },
    )).rejects.toThrow(/120/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses authoritative propose/respond trade commands', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'x', commandType: 'propose_trade' },
      error: null,
    });
    await proposeMissionFourTrade(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId,
        targetWagonNumber: 2, itemKey: 'water', quantity: 1,
      },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({ p_command_type: 'propose_trade' }));
    rpc.mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'x', commandType: 'respond_trade' },
      error: null,
    });
    await respondMissionFourTrade(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'd', instanceId: active.instanceId,
        transferId: 't', response: 'accept',
      },
    );
    expect(rpc).toHaveBeenLastCalledWith('submit_bunker_command', expect.objectContaining({ p_command_type: 'respond_trade' }));
  });

  it('submits a group answer only through submit_answer', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'x', commandType: 'submit_answer' },
      error: null,
    });
    await submitMissionFourAnswer(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c',
        instanceId: active.instanceId, answer: 'СВЯЗЬ',
      },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({ p_command_type: 'submit_answer' }));
  });
});
