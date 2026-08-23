import { describe, expect, it, vi } from 'vitest';
import {
  commitMissionThreeAbility,
  confirmMissionThree,
  getGuestMissionThreeReadModel,
  getMissionThreeScreenReadModel,
  parseMissionThreeGuestReadModel,
} from './m03.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:20:00.000Z',
  deadlineAt: '2026-08-30T18:26:00.000Z',
  instanceId: '53000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  title: 'Аварийный запас',
  intro: 'У вагона пять проблем. Закрыть можно не больше трёх.',
  wagon: { number: 2, label: 'ВАГОН №2' },
  memberRole: 'captain',
  problems: [
    { key: 'injury', title: 'Ранен пассажир', risk: 'Без помощи состояние ухудшится.', itemKey: 'medkit' },
    { key: 'communication', title: 'Пропадает связь', risk: 'Вагон потеряет связь с соседями.', itemKey: 'radio' },
    { key: 'power', title: 'Падает питание', risk: 'Системы начнут отключаться.', itemKey: 'generator' },
    { key: 'mechanism', title: 'Заклинило механизм', risk: 'Техническая дверь может быть повреждена.', itemKey: 'tools' },
    { key: 'water', title: 'Запас воды под угрозой', risk: 'Вода станет ограниченной.', itemKey: 'water' },
  ],
  inventory: [
    { itemKey: 'medkit', quantity: 1, status: 'available' },
    { itemKey: 'water', quantity: 2, status: 'available' },
  ],
  selectedProblems: [],
  ability: { available: true, key: 'medical_help', problemKey: 'injury', label: 'Медицинская помощь' },
  pendingCommitments: [],
} as const;

const screenModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:20:00.000Z',
  deadlineAt: '2026-08-30T18:26:00.000Z',
  title: 'Аварийный запас',
  wagons: [
    { wagonId: 'w1', label: 'ВАГОН №1', status: 'active', solvedCount: 0 },
    { wagonId: 'w2', label: 'ВАГОН №2', status: 'completed', solvedCount: 3 },
  ],
} as const;

describe('M03 service', () => {
  it('parses five problems and Russian inventory without exposing another guest ability', async () => {
    const model = await getGuestMissionThreeReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: active, error: null }) },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('active expected');
    expect(model.problems).toHaveLength(5);
    expect(model.memberRole).toBe('captain');
  });

  it('rejects malformed role, boolean, commitment status and outcome instead of guessing defaults', () => {
    expect(() => parseMissionThreeGuestReadModel({ ...active, memberRole: 'observer' })).toThrow(/member role/i);
    expect(() => parseMissionThreeGuestReadModel({
      ...active,
      ability: { ...active.ability, available: 'false' },
    })).toThrow(/ability available/i);
    expect(() => parseMissionThreeGuestReadModel({
      ...active,
      pendingCommitments: [{ problemKey: 'injury', status: 'done', label: 'Готово' }],
    })).toThrow(/commitment status/i);
    expect(() => parseMissionThreeGuestReadModel({ ...active, outcome: [] })).toThrow(/outcome/i);
  });

  it('validates the TV/owner projection at runtime instead of trusting a type assertion', async () => {
    const valid = await getMissionThreeScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: screenModel, error: null }) },
      'liza-viktor',
    );
    expect(valid).toEqual(screenModel);

    await expect(getMissionThreeScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: { ...screenModel, wagons: [{ ...screenModel.wagons[0], status: 'done' }] }, error: null }) },
      'liza-viktor',
    )).rejects.toThrow(/wagon status/i);
  });

  it('commits only the caller ability to one problem', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'use_ability' },
      error: null,
    });
    await commitMissionThreeAbility(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId, problemKey: 'injury' },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'use_ability',
      p_payload: { instanceId: active.instanceId, problemKey: 'injury' },
    }));
  });

  it('captain confirms at most three problem keys using instance version', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'mission_confirm' },
      error: null,
    });
    await confirmMissionThree(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId,
        instanceVersion: 1, selectedProblems: ['injury', 'power', 'water'],
      },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({ p_command_type: 'mission_confirm' }));
    await expect(confirmMissionThree(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c2', instanceId: active.instanceId,
        instanceVersion: 1, selectedProblems: ['injury', 'power', 'water', 'mechanism'],
      },
    )).rejects.toThrow(/three/i);
  });
});
