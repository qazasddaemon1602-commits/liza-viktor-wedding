import { describe, expect, it, vi } from 'vitest';
import {
  confirmMissionOneSelection,
  parseMissionOneGuestRuntime,
  type MissionOneRpcClient,
} from './m01.service';

const baseRuntime = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-21T18:04:00.000Z',
  state: 'MISSION_01',
  planVersion: 1,
  runNonce: '41000000-0000-4000-8000-000000000001',
  viewer: {
    kind: 'guest',
    guest: {
      id: '41000000-0000-4000-9000-000000000001',
      realName: 'Анна-Мария Очень-Длинная-Фамилия',
    },
    wagon: { number: 1, label: 'ВАГОН №1' },
  },
  character: {
    profileKey: 'mechanic',
    profileVersion: 1,
    profession: 'Механик',
    health: 'Полностью здоров',
    visibleSkill: 'Чинит механизмы',
    specialAbility: 'mechanical_fix',
    abilityDescription: 'Устраняет поломку.',
    abilityUsesRemaining: 1,
    status: 'active',
    m01Eligibility: 'frozen_member',
    hiddenTraitRevealed: false,
  },
  currentMission: {
    instanceId: '41000000-0000-4000-8000-000000000010',
    instanceVersion: 1,
    code: 'MISSION_01',
    status: 'active',
    scope: 'wagon',
  },
} as const;

describe('Mission one runtime parser', () => {
  it('keeps the hidden trait absent before authoritative confirmation', () => {
    const runtime = parseMissionOneGuestRuntime(baseRuntime);

    expect(runtime.character.hiddenTraitRevealed).toBe(false);
    expect(runtime.character).not.toHaveProperty('hiddenTrait');
  });

  it('returns the registered full guest name and revealed trait after confirmation', () => {
    const runtime = parseMissionOneGuestRuntime({
      ...baseRuntime,
      character: {
        ...baseRuntime.character,
        status: 'excluded',
        hiddenTraitRevealed: true,
        hiddenTrait: 'Боится замкнутых пространств',
      },
      currentMission: { ...baseRuntime.currentMission, status: 'completed' },
    });

    expect(runtime.viewer.guest.realName).toBe('Анна-Мария Очень-Длинная-Фамилия');
    expect(runtime.character).toMatchObject({
      status: 'excluded',
      hiddenTraitRevealed: true,
      hiddenTrait: 'Боится замкнутых пространств',
    });
  });

  it('rejects a runtime from any stage other than mission one', () => {
    expect(() => parseMissionOneGuestRuntime({
      ...baseRuntime,
      state: 'MISSION_02',
      currentMission: { ...baseRuntime.currentMission, code: 'MISSION_02' },
    })).toThrow(/mission one/i);
  });
});

describe('Mission one confirmation transport', () => {
  it('submits only the frozen instance version and selected guest IDs', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        contractVersion: 2,
        status: 'accepted',
        commandId: '41000000-0000-4000-8000-000000000020',
        commandType: 'mission_confirm',
      },
      error: null,
    });
    const client: MissionOneRpcClient = { rpc };

    await expect(confirmMissionOneSelection(client, {
      eventSlug: 'bunker-v2-m01-m02',
      deviceKey: 'm01-device-one',
      commandId: '41000000-0000-4000-8000-000000000020',
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 1,
      selectedGuestIds: [
        '41000000-0000-4000-9000-000000000001',
        '41000000-0000-4000-9000-000000000003',
      ],
    })).resolves.toMatchObject({ status: 'accepted', commandType: 'mission_confirm' });

    expect(rpc).toHaveBeenCalledWith('submit_bunker_command', {
      p_event_slug: 'bunker-v2-m01-m02',
      p_device_key: 'm01-device-one',
      p_command_id: '41000000-0000-4000-8000-000000000020',
      p_command_type: 'mission_confirm',
      p_payload: {
        instanceId: '41000000-0000-4000-8000-000000000010',
        instanceVersion: 1,
        selection: [
          '41000000-0000-4000-9000-000000000001',
          '41000000-0000-4000-9000-000000000003',
        ],
      },
    });
  });
});
