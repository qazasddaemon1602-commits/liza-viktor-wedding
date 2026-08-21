// @ts-expect-error Vitest runs this SQL contract check in Node; browser types omit Node.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  confirmMissionOneSelection,
  getGuestMissionOneReadModel,
  getMissionOneScreenReadModel,
  getOwnerMissionOneReadModel,
  overrideMissionOneSelection,
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

const guestReadModel = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-21T18:00:01.000Z',
  instanceId: '41000000-0000-4000-8000-000000000010',
  instanceVersion: 1,
  deadlineAt: '2026-08-21T18:04:00.000Z',
  wagon: {
    id: '41000000-0000-4000-8000-000000000100',
    number: 1,
    label: 'ВАГОН №1',
  },
  quota: 2,
  members: [{
    guestId: '41000000-0000-4000-9000-000000000001',
    realName: 'Анна-Мария Очень-Длинная-Фамилия',
    profession: 'Механик',
    health: 'Полностью здорова',
    visibleSkill: 'Чинит механизмы',
  }],
  selectedGuestIds: [],
} as const;

describe('Mission one server read models', () => {
  it('parses the exact V1 legacy screen contract returned by the public RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        contractVersion: 1,
        status: 'legacy',
        serverNow: '2026-08-21T18:00:01.000Z',
      },
      error: null,
    });

    await expect(getMissionOneScreenReadModel({ rpc }, 'liza-viktor')).resolves.toEqual({
      contractVersion: 1,
      status: 'legacy',
      serverNow: '2026-08-21T18:00:01.000Z',
    });
  });

  it('preserves V2 contract identity while M01 is idle during a screen transition', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        contractVersion: 2,
        status: 'idle',
        serverNow: '2026-08-21T18:04:01.000Z',
      },
      error: null,
    });

    await expect(getMissionOneScreenReadModel({ rpc }, 'liza-viktor')).resolves.toEqual({
      contractVersion: 2,
      status: 'idle',
      serverNow: '2026-08-21T18:04:01.000Z',
    });
  });

  it('rejects guest-only unavailable statuses on the public screen RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        contractVersion: 2,
        status: 'guest_not_found',
        serverNow: '2026-08-21T18:04:01.000Z',
      },
      error: null,
    });

    await expect(getMissionOneScreenReadModel({ rpc }, 'liza-viktor'))
      .rejects.toThrow(/public read model/i);
  });

  it('loads the guest frozen quota and registered members without private traits', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: guestReadModel, error: null });

    const result = await getGuestMissionOneReadModel(
      { rpc },
      'liza-viktor',
      'device-key',
    );

    expect(result).toMatchObject({
      status: 'active',
      quota: 2,
      members: [{ realName: 'Анна-Мария Очень-Длинная-Фамилия' }],
    });
    expect(JSON.stringify(result)).not.toContain('hiddenTrait');
    expect(rpc).toHaveBeenCalledWith('get_guest_bunker_v2_m01', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-key',
    });
  });

  it('loads owner instance progress and submits a reason-bound override command', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          contractVersion: 2,
          status: 'active',
          serverNow: '2026-08-21T18:00:01.000Z',
          deadlineAt: '2026-08-21T18:04:00.000Z',
          wagons: [{
            wagonId: '41000000-0000-4000-8000-000000000100',
            instanceId: '41000000-0000-4000-8000-000000000010',
            instanceVersion: 1,
            label: 'ВАГОН №1',
            quota: 2,
            status: 'completed',
            selectedGuestIds: [
              '41000000-0000-4000-9000-000000000001',
              '41000000-0000-4000-9000-000000000002',
            ],
            members: [{
              guestId: '41000000-0000-4000-9000-000000000001',
              realName: 'Анна-Мария Очень-Длинная-Фамилия',
              profession: 'Механик',
            }],
          }],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          contractVersion: 2,
          status: 'accepted',
          commandId: '41000000-0000-4000-8000-000000000020',
          commandType: 'owner_m01_override',
        },
        error: null,
      });

    await expect(getOwnerMissionOneReadModel({ rpc }, 'event-1')).resolves.toMatchObject({
      status: 'active',
      wagons: [{ label: 'ВАГОН №1', status: 'completed' }],
    });
    await expect(overrideMissionOneSelection({ rpc }, {
      eventId: 'event-1',
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 1,
      commandId: '41000000-0000-4000-8000-000000000020',
      selectedGuestIds: [
        '41000000-0000-4000-9000-000000000001',
        '41000000-0000-4000-9000-000000000003',
      ],
      reason: 'Исправляем подтверждённую ошибку команды',
    })).resolves.toMatchObject({ status: 'accepted' });
    expect(rpc).toHaveBeenLastCalledWith('owner_override_bunker_v2_m01', {
      p_event_id: 'event-1',
      p_instance_id: '41000000-0000-4000-8000-000000000010',
      p_instance_version: 1,
      p_command_id: '41000000-0000-4000-8000-000000000020',
      p_selected_guest_ids: [
        '41000000-0000-4000-9000-000000000001',
        '41000000-0000-4000-9000-000000000003',
      ],
      p_reason: 'Исправляем подтверждённую ошибку команды',
    });
  });

  it('rejects a public TV payload that leaks a registered name or private trait', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        contractVersion: 2,
        status: 'active',
        serverNow: '2026-08-21T18:00:01.000Z',
        deadlineAt: '2026-08-21T18:04:00.000Z',
        title: 'Лишний пассажир',
        publicSummary: 'Вагоны принимают командное решение.',
        wagons: [{
          wagonId: '41000000-0000-4000-8000-000000000100',
          label: 'ВАГОН №1',
          status: 'completed',
          realName: 'Анна-Мария Очень-Длинная-Фамилия',
          hiddenTrait: 'Боится темноты',
        }],
      },
      error: null,
    });

    await expect(getMissionOneScreenReadModel({ rpc }, 'liza-viktor'))
      .rejects.toThrow(/public wagon/i);
  });
});

describe('M01 read-model SQL boundary', () => {
  const migration = readFileSync(
    `${(globalThis as typeof globalThis & { process: { cwd: () => string } }).process.cwd()}/supabase/migrations/20260821190238_bunker_v2_m01_read_models.sql`,
    'utf8',
  );

  it('pins all four security-definer functions and exposes only narrow RPC grants', () => {
    expect(migration.match(/security definer\s+set search_path = ''/gi)).toHaveLength(4);
    expect(migration).toMatch(/revoke all on function public\.get_owner_bunker_v2_m01\(uuid\)[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.get_bunker_v2_m01_screen\(text\)\s+to anon, authenticated/i);
    expect(migration).not.toMatch(/grant\s+select[\s\S]+bunker_(mission|guest)/i);
  });

  it('keeps TV aggregate-only and the owner mutation reason-bound and auditable', () => {
    const screenFunction = migration.match(
      /create or replace function public\.get_bunker_v2_m01_screen[\s\S]+?end;\s*\$\$;/i,
    )?.[0] ?? '';
    expect(screenFunction).not.toMatch(/public\.guests|bunker_guest_profiles|hidden_fact|realName/i);
    expect(screenFunction).toMatch(/bunker_mission_instances/);

    const overrideFunction = migration.match(
      /create or replace function public\.owner_override_bunker_v2_m01[\s\S]+?end;\s*\$\$;/i,
    )?.[0] ?? '';
    expect(overrideFunction).toMatch(/btrim\(p_reason\)/);
    expect(overrideFunction).toMatch(/instance_version/);
    expect(overrideFunction).toMatch(/bunker_command_receipts/);
    expect(overrideFunction).toMatch(/bunker_game_events/);
  });
});

describe('M01 public screen contract-version migration', () => {
  const migration = readFileSync(
    `${(globalThis as typeof globalThis & { process: { cwd: () => string } }).process.cwd()}/supabase/migrations/20260821193853_bunker_v2_m01_screen_contract_version.sql`,
    'utf8',
  );

  it('returns an authoritative V1 legacy or V2 idle contract without private TV data', () => {
    const screenFunction = migration.match(
      /create or replace function public\.get_bunker_v2_m01_screen[\s\S]+?end;\s*\$\$;/i,
    )?.[0] ?? '';

    expect(screenFunction).toMatch(/security definer\s+set search_path = ''/i);
    expect(screenFunction).toMatch(/v_contract_version = 1[\s\S]+?'contractVersion', 1[\s\S]+?'status', 'legacy'/i);
    expect(screenFunction).toMatch(/v_contract_version is distinct from 2[\s\S]+?'contractVersion', 2[\s\S]+?'status', 'idle'/i);
    expect(screenFunction).not.toMatch(/public\.guests|bunker_guest_profiles|hidden_fact|realName/i);
  });

  it('resets the default execute privilege and grants only the public read roles', () => {
    expect(migration).toMatch(
      /revoke all on function public\.get_bunker_v2_m01_screen\(text\)\s+from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.get_bunker_v2_m01_screen\(text\)\s+to anon, authenticated/i,
    );
  });
});
