import { describe, expect, it, vi } from 'vitest';
import type { BunkerRpcClient } from './bunker.service';
import {
  forceCompleteBunkerGlobalMission,
  parseGuestBunkerGlobalMissionSubmission,
  submitGuestBunkerGlobalMission,
} from './bunkerGlobalMission.service';

const completedAt = '2026-08-30T18:10:00.000Z';

describe('global Bunker mission service', () => {
  it('parses a completed authoritative wagon action', () => {
    expect(parseGuestBunkerGlobalMissionSubmission({
      status: 'completed',
      missionState: 'MISSION_05',
      carriageId: '00000000-0000-4000-8000-000000000821',
      completedAt,
      changed: true,
      submittedPayload: { routeChoice: 'safe', itemKey: 'radio' },
    })).toEqual({
      status: 'completed',
      missionState: 'MISSION_05',
      carriageId: '00000000-0000-4000-8000-000000000821',
      completedAt,
      changed: true,
      submittedPayload: { routeChoice: 'safe', itemKey: 'radio' },
    });
  });

  it('rejects a malformed or non-current global mission result', () => {
    expect(() => parseGuestBunkerGlobalMissionSubmission({
      status: 'completed', missionState: 'FINAL_30', carriageId: 'wagon-1',
      completedAt, changed: true, submittedPayload: {},
    })).toThrow(/global mission/i);
    expect(() => parseGuestBunkerGlobalMissionSubmission({
      status: 'completed', missionState: 'MISSION_03', carriageId: '',
      completedAt, changed: true, submittedPayload: [],
    })).toThrow(/global mission/i);
  });

  it('submits the discriminated mission payload through the device-authenticated RPC', async () => {
    const data = {
      status: 'completed', missionState: 'MISSION_03', carriageId: 'wagon-2',
      completedAt, changed: true, submittedPayload: { itemKeys: ['water', 'radio'] },
    };
    const client: BunkerRpcClient = {
      rpc: vi.fn().mockResolvedValue({ data, error: null }),
    };

    await expect(submitGuestBunkerGlobalMission(
      client,
      'liza-viktor',
      'device-secret',
      'MISSION_03',
      { itemKeys: ['water', 'radio'] },
    )).resolves.toEqual(data);
    expect(client.rpc).toHaveBeenCalledWith('submit_guest_bunker_global_mission', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-secret',
      p_mission_state: 'MISSION_03',
      p_payload: { itemKeys: ['water', 'radio'] },
    });
  });

  it('forwards the optional M04 transfer as part of the authoritative mission payload', async () => {
    const data = {
      status: 'completed', missionState: 'MISSION_04', carriageId: 'wagon-2',
      completedAt, changed: true,
      submittedPayload: {
        message: 'Сектор 04 найден через тоннель',
        partnerWagonIds: ['wagon-5'],
        transferItemKey: 'radio',
        transferToWagonId: 'wagon-5',
      },
    };
    const client: BunkerRpcClient = {
      rpc: vi.fn().mockResolvedValue({ data, error: null }),
    };

    await expect(submitGuestBunkerGlobalMission(
      client,
      'liza-viktor',
      'device-secret',
      'MISSION_04',
      {
        message: 'Сектор 04 найден через тоннель',
        partnerWagonIds: ['wagon-5'],
        transferItemKey: 'radio',
        transferToWagonId: 'wagon-5',
      },
    )).resolves.toEqual(data);
    expect(client.rpc).toHaveBeenCalledWith('submit_guest_bunker_global_mission', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-secret',
      p_mission_state: 'MISSION_04',
      p_payload: {
        message: 'Сектор 04 найден через тоннель',
        partnerWagonIds: ['wagon-5'],
        transferItemKey: 'radio',
        transferToWagonId: 'wagon-5',
      },
    });
  });

  it('calls the owner recovery RPC for one wagon in the current mission', async () => {
    const data = {
      status: 'completed', missionState: 'MISSION_04', carriageId: 'wagon-2',
      completedAt, changed: true, submittedPayload: { forced: true },
    };
    const client: BunkerRpcClient = {
      rpc: vi.fn().mockResolvedValue({ data, error: null }),
    };

    await expect(forceCompleteBunkerGlobalMission(
      client, 'event-1', 'wagon-2', 'MISSION_04',
    )).resolves.toEqual(data);
    expect(client.rpc).toHaveBeenCalledWith('owner_force_complete_bunker_global_mission', {
      p_event_id: 'event-1',
      p_carriage_id: 'wagon-2',
      p_mission_state: 'MISSION_04',
    });
  });
});
