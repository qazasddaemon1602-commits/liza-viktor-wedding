import { describe, expect, it, vi } from 'vitest';
import {
  castMissionFiveVote,
  getGuestMissionFiveReadModel,
  getMissionFiveScreenReadModel,
  parseMissionFiveGuestReadModel,
  useMissionFiveAbility,
} from './m05.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:40:00.000Z',
  deadlineAt: '2026-08-30T18:41:30.000Z',
  instanceId: '55000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  title: 'Один шанс',
  intro: 'У вас 90 секунд. Выберите маршрут вагона.',
  wagon: { number: 1, label: 'ВАГОН №1' },
  routes: [
    { key: 'A', title: 'Технический тоннель', description: 'Короче, но нестабильнее.', risk: 'Повышенный риск повреждений.' },
    { key: 'B', title: 'Обходной путь', description: 'Дольше, но безопаснее.', risk: 'Можно потерять время.' },
  ],
  selectedVote: null,
  voteCounts: { A: 1, B: 1, total: 2, required: 4 },
  ability: {
    available: true,
    key: 'route_analysis',
    label: 'Анализ маршрута',
    hint: 'Можно запросить техническую подсказку.',
  },
} as const;

const screenModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:40:00.000Z',
  deadlineAt: '2026-08-30T18:41:30.000Z',
  title: 'Один шанс',
  wagons: [
    { wagonId: 'w1', label: 'ВАГОН №1', status: 'active', votesA: 1, votesB: 1, required: 3, routeChoice: null },
    { wagonId: 'w2', label: 'ВАГОН №2', status: 'completed', votesA: 0, votesB: 4, required: 3, routeChoice: 'B' },
  ],
} as const;

describe('M05 service', () => {
  it('parses public routes and vote progress without pre-revealing consequences', async () => {
    const model = await getGuestMissionFiveReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: active, error: null }) },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('active expected');
    expect(model.routes).toHaveLength(2);
    expect(JSON.stringify(model)).not.toContain('trackDamage');
    expect(JSON.stringify(model)).not.toContain('sector04Found');
  });

  it('rejects malformed route votes, booleans and outcome flags instead of coercing them', () => {
    expect(() => parseMissionFiveGuestReadModel({ ...active, selectedVote: 'C' })).toThrow(/selected vote/i);
    expect(() => parseMissionFiveGuestReadModel({
      ...active,
      ability: { ...active.ability, available: 'false' },
    })).toThrow(/ability available/i);
    expect(() => parseMissionFiveGuestReadModel({
      ...active,
      status: 'completed',
      outcome: {
        routeChoice: 'B', routeBonusMinutes: -5, trackDamage: 0, powerInstability: 0,
        sector04Found: 'false', tier: 'safe', fallback: false,
      },
    })).toThrow(/sector discovery/i);
    expect(() => parseMissionFiveGuestReadModel({
      ...active,
      status: 'completed',
      outcome: {
        routeChoice: 'B', routeBonusMinutes: -5, trackDamage: 0, powerInstability: 0,
        sector04Found: false, tier: 'safe', fallback: 'false',
      },
    })).toThrow(/fallback/i);
  });

  it('validates the TV/owner projection at runtime', async () => {
    const valid = await getMissionFiveScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: screenModel, error: null }) },
      'liza-viktor',
    );
    expect(valid).toEqual(screenModel);

    await expect(getMissionFiveScreenReadModel(
      {
        rpc: vi.fn().mockResolvedValue({
          data: { ...screenModel, wagons: [{ ...screenModel.wagons[0], routeChoice: 'C' }] },
          error: null,
        }),
      },
      'liza-viktor',
    )).rejects.toThrow(/route choice/i);
  });

  it('casts only A or B via cast_vote', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'cast_vote' },
      error: null,
    });
    await castMissionFiveVote(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId, vote: 'A' },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'cast_vote',
      p_payload: { instanceId: active.instanceId, vote: 'A' },
    }));
    await expect(castMissionFiveVote(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'x', instanceId: active.instanceId, vote: 'C' as 'A' },
    )).rejects.toThrow(/A or B/);
  });

  it('uses a personal navigation ability through use_ability', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'use_ability' },
      error: null,
    });
    await useMissionFiveAbility(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'use_ability',
      p_payload: { instanceId: active.instanceId, problemKey: 'route_choice' },
    }));
  });
});
