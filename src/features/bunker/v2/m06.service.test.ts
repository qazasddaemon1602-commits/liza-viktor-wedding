import { describe, expect, it, vi } from 'vitest';
import {
  castMissionSixVote,
  getGuestMissionSixReadModel,
  getMissionSixScreenReadModel,
  parseMissionSixGuestReadModel,
  revealMissionSixFragment,
  useMissionSixAbility,
} from './m06.service';

const active = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:50:00.000Z',
  deadlineAt: '2026-08-30T18:58:00.000Z',
  instanceId: '56000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  title: 'Общий протокол',
  intro: 'У каждого вагона свой фрагмент. Объедините данные и согласуйте один протокол.',
  viewer: { wagonId: 'w1', wagonNumber: 1, canVote: true },
  privateFragment: {
    key: 'protocol_fragment_1',
    label: 'Фрагмент вагона 01',
    body: 'В служебном архиве повторяется обозначение TUNNEL B.',
  },
  fragmentShared: false,
  revealedFragments: [],
  fragmentsRevealed: 0,
  fragmentsTotal: 3,
  options: [
    { key: 'A', title: 'Протокол A', summary: 'TUNNEL A · SECTOR 03' },
    { key: 'B', title: 'Протокол B', summary: 'TUNNEL B · SECTOR 04' },
    { key: 'C', title: 'Протокол C', summary: 'SERVICE SHAFT · SECTOR 05' },
  ],
  selectedVote: null,
  wagonConsensus: [
    { wagonId: 'w1', label: 'ВАГОН №1', votesA: 1, votesB: 2, votesC: 0, required: 3, consensus: null },
    { wagonId: 'w2', label: 'ВАГОН №2', votesA: 0, votesB: 3, votesC: 0, required: 3, consensus: 'B' },
    { wagonId: 'w3', label: 'ВАГОН №3', votesA: 0, votesB: 1, votesC: 1, required: 2, consensus: null },
  ],
  ability: {
    available: true,
    key: 'bunker_knowledge',
    label: 'Знание объекта',
    hint: 'Можно запросить одну дополнительную проверку протокола.',
  },
} as const;

const screenModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-30T18:50:00.000Z',
  deadlineAt: '2026-08-30T18:58:00.000Z',
  title: 'Общий протокол',
  fragmentsRevealed: 1,
  fragmentsTotal: 3,
  wagons: [
    { wagonId: 'w1', label: 'ВАГОН №1', consensusReady: false },
    { wagonId: 'w2', label: 'ВАГОН №2', consensusReady: true },
    { wagonId: 'w3', label: 'ВАГОН №3', consensusReady: false },
  ],
} as const;

describe('M06 service', () => {
  it('parses a private fragment and only already-shared global fragments', async () => {
    const model = await getGuestMissionSixReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: active, error: null }) },
      'liza-viktor',
      'device',
    );
    expect(model.status).toBe('active');
    if (model.status !== 'active') throw new Error('expected active');
    expect(model.privateFragment.key).toBe('protocol_fragment_1');
    expect(model.revealedFragments).toHaveLength(0);
    expect(model.options).toHaveLength(3);
    expect(JSON.stringify(model)).not.toContain('4719');
  });

  it('rejects malformed booleans, selected vote and consensus instead of coercing them', () => {
    expect(() => parseMissionSixGuestReadModel({
      ...active,
      viewer: { ...active.viewer, canVote: 'false' },
    })).toThrow(/can vote/i);
    expect(() => parseMissionSixGuestReadModel({ ...active, fragmentShared: 'false' })).toThrow(/fragment shared/i);
    expect(() => parseMissionSixGuestReadModel({ ...active, selectedVote: 'D' })).toThrow(/selected vote/i);
    expect(() => parseMissionSixGuestReadModel({
      ...active,
      wagonConsensus: [{ ...active.wagonConsensus[0], consensus: 'D' }],
    })).toThrow(/consensus/i);
  });

  it('validates the TV/owner projection at runtime and keeps secrets out of it', async () => {
    const valid = await getMissionSixScreenReadModel(
      { rpc: vi.fn().mockResolvedValue({ data: screenModel, error: null }) },
      'liza-viktor',
    );
    expect(valid).toEqual(screenModel);
    expect(JSON.stringify(valid)).not.toContain('4719');

    await expect(getMissionSixScreenReadModel(
      {
        rpc: vi.fn().mockResolvedValue({
          data: { ...screenModel, wagons: [{ ...screenModel.wagons[0], consensusReady: 'false' }] },
          error: null,
        }),
      },
      'liza-viktor',
    )).rejects.toThrow(/consensus ready/i);
  });

  it('shares only the viewer wagon fragment through reveal_fragment', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'reveal_fragment' },
      error: null,
    });
    await revealMissionSixFragment(
      { rpc },
      {
        eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId,
        fragmentKey: active.privateFragment.key,
      },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'reveal_fragment',
      p_payload: { instanceId: active.instanceId, fragmentKey: 'protocol_fragment_1' },
    }));
  });

  it('casts only A/B/C through the authoritative vote command', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'cast_vote' },
      error: null,
    });
    await castMissionSixVote(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId, vote: 'B' },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'cast_vote',
      p_payload: { instanceId: active.instanceId, vote: 'B' },
    }));
    await expect(castMissionSixVote(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'x', instanceId: active.instanceId, vote: 'D' as 'A' },
    )).rejects.toThrow(/A, B or C/);
  });

  it('uses only the caller personal ability for protocol analysis', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { contractVersion: 2, status: 'accepted', commandId: 'c', commandType: 'use_ability' },
      error: null,
    });
    await useMissionSixAbility(
      { rpc },
      { eventSlug: 'liza-viktor', deviceKey: 'device', commandId: 'c', instanceId: active.instanceId },
    );
    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', expect.objectContaining({
      p_command_type: 'use_ability',
      p_payload: { instanceId: active.instanceId, problemKey: 'protocol' },
    }));
  });
});
