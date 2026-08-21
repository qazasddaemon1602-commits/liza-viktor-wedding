import { describe, expect, it, vi } from 'vitest';
import {
  getGuestBunkerV2Runtime,
  getOwnerBunkerV2Runtime,
  type BunkerV2RuntimeRpcClient,
} from './runtime.service';

const idleRuntime = {
  contractVersion: 2,
  status: 'idle',
  serverNow: '2026-08-21T18:00:00.000Z',
};

const activeGuestRuntime = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-21T18:00:00.000Z',
  state: 'UNKNOWN_PASSENGER',
  planVersion: 1,
  runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
  viewer: {
    kind: 'guest',
    guest: { id: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42', realName: 'Сергей П.' },
    wagon: { number: 2, label: 'Вагон №2' },
  },
  character: {
    profileKey: 'mechanic', profileVersion: 2, profession: 'МЕХАНИК', health: 'отличное',
    visibleSkill: 'ремонт', specialAbility: 'mechanical_fix', abilityDescription: 'Ремонт.',
    abilityUsesRemaining: 1, status: 'saved', m01Eligibility: 'frozen_member',
    hiddenTraitRevealed: false,
  },
  currentMission: {
    instanceId: '9e7d6779-f551-4c83-8582-0523e7d02171', instanceVersion: 1,
    code: 'UNKNOWN_PASSENGER', status: 'active', scope: 'global',
  },
};

const activeOwnerRuntime = {
  contractVersion: 2,
  status: 'active',
  serverNow: '2026-08-21T18:00:00.000Z',
  state: 'UNKNOWN_PASSENGER',
  planVersion: 1,
  runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
  viewer: { kind: 'owner' },
  currentMission: activeGuestRuntime.currentMission,
};

describe('Bunker V2 runtime transport', () => {
  it('uses the guest V2 read RPC and parses V2 only', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: idleRuntime, error: null });
    const client: BunkerV2RuntimeRpcClient = { rpc };

    await expect(getGuestBunkerV2Runtime(client, 'wedding', 'device-key'))
      .resolves.toEqual(idleRuntime);
    expect(rpc).toHaveBeenCalledWith('get_guest_bunker_v2_runtime', {
      p_event_slug: 'wedding',
      p_device_key: 'device-key',
    });

    await expect(getGuestBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: { ...idleRuntime, contractVersion: 1 }, error: null }) },
      'wedding',
      'device-key',
    )).rejects.toThrow(/version/i);
  });

  it('uses the owner V2 read RPC without guest authority arguments', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: idleRuntime, error: null });
    const client: BunkerV2RuntimeRpcClient = { rpc };

    await expect(getOwnerBunkerV2Runtime(client, 'event-1')).resolves.toEqual(idleRuntime);
    expect(rpc).toHaveBeenCalledWith('get_owner_bunker_v2_runtime', { p_event_id: 'event-1' });
  });

  it('preserves read RPC error codes', async () => {
    await expect(getOwnerBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'owner only', code: '42501' } }) },
      'event-1',
    )).rejects.toMatchObject({ message: 'owner only', code: '42501' });
  });

  it('returns active viewer-specific runtime and rejects cross-view payloads', async () => {
    await expect(getGuestBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: activeGuestRuntime, error: null }) },
      'wedding', 'device-key',
    )).resolves.toMatchObject({ status: 'active', viewer: { kind: 'guest' } });
    await expect(getOwnerBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: activeOwnerRuntime, error: null }) },
      'event-1',
    )).resolves.toMatchObject({ status: 'active', viewer: { kind: 'owner' } });

    await expect(getGuestBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: activeOwnerRuntime, error: null }) },
      'wedding', 'device-key',
    )).rejects.toThrow(/guest viewer/i);
    await expect(getOwnerBunkerV2Runtime(
      { rpc: vi.fn().mockResolvedValue({ data: activeGuestRuntime, error: null }) },
      'event-1',
    )).rejects.toThrow(/owner viewer/i);
  });
});
