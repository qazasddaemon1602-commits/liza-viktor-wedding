import { describe, expect, it, vi } from 'vitest';
import {
  getGuestBunkerV2Dashboard,
  parseBunkerV2DashboardReadModel,
} from './dashboard.service';

const serverNow = '2026-08-22T05:30:00.000Z';

const activePayload = {
  contractVersion: 2,
  status: 'active',
  serverNow,
  wagon: { id: 'wagon-2', number: 2, label: 'ВАГОН №2' },
  passengers: [
    {
      guestId: 'guest-1',
      realName: 'Анна Петрова',
      profession: 'ХИРУРГ',
      visibleSkill: 'первая помощь',
      characterStatus: 'active',
      hiddenTraitRevealed: false,
    },
    {
      guestId: 'guest-2',
      realName: 'Иван Сидоров',
      profession: 'МЕХАНИК',
      visibleSkill: 'ремонт механизмов',
      characterStatus: 'excluded',
      hiddenTraitRevealed: true,
      hiddenTrait: 'Раньше обслуживал этот поезд.',
    },
  ],
  inventory: [
    { itemKey: 'medkit', available: 1, used: 1, transferred: 0, lost: 0 },
    { itemKey: 'water', available: 1, used: 0, transferred: 1, lost: 0 },
  ],
  archive: [
    {
      artifactKey: 'BK-17',
      contentType: 'document',
      decryptionStatus: 'decoded',
      scope: 'wagon',
      content: { title: 'BK-17' },
    },
    {
      artifactKey: 'SEALED',
      contentType: 'document',
      decryptionStatus: 'locked',
      scope: 'global',
      content: {},
    },
  ],
  wagonState: {
    powerStatus: 'unstable',
    communicationStatus: 'working',
    navigationStatus: 'degraded',
    technicalDoorStatus: 'unlocked',
    trackDamage: 15,
    waterStatus: 'limited',
    routeChoice: 'A',
    routeBonus: -30,
    powerInstability: 2,
    sector04Found: true,
    coordinationBonus: false,
  },
} as const;

describe('persistent Bunker V2 dashboard service', () => {
  it('parses the complete active durable dashboard projection', () => {
    expect(parseBunkerV2DashboardReadModel(activePayload)).toEqual(activePayload);
  });

  it.each(['idle', 'not_found', 'legacy'] as const)('parses %s without durable data', (status) => {
    expect(parseBunkerV2DashboardReadModel({ contractVersion: 2, status, serverNow })).toEqual({
      contractVersion: 2,
      status,
      serverNow,
    });
  });

  it('rejects an unrevealed hidden trait even if a server payload accidentally includes it', () => {
    const passenger = { ...activePayload.passengers[0], hiddenTrait: 'SECRET' };
    expect(() => parseBunkerV2DashboardReadModel({
      ...activePayload,
      passengers: [passenger],
    })).toThrow(/hidden trait/i);
  });

  it('rejects locked archive content instead of displaying a leaked payload', () => {
    const locked = {
      ...activePayload.archive[1],
      content: { accessCode: '4719' },
    };
    expect(() => parseBunkerV2DashboardReadModel({
      ...activePayload,
      archive: [locked],
    })).toThrow(/locked archive/i);
  });

  it('rejects invalid inventory quantities and wagon-state enums', () => {
    expect(() => parseBunkerV2DashboardReadModel({
      ...activePayload,
      inventory: [{ itemKey: 'water', available: -1, used: 0, transferred: 0, lost: 0 }],
    })).toThrow(/inventory/i);

    expect(() => parseBunkerV2DashboardReadModel({
      ...activePayload,
      wagonState: { ...activePayload.wagonState, powerStatus: 'magic' },
    })).toThrow(/wagon state/i);
  });

  it('rejects extra top-level fields so the projection cannot silently expand', () => {
    expect(() => parseBunkerV2DashboardReadModel({
      ...activePayload,
      canonicalValue: '4719',
    })).toThrow(/dashboard/i);
  });

  it('calls only the read-only dashboard RPC with event and device identity', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: activePayload, error: null });
    await expect(getGuestBunkerV2Dashboard({ rpc }, 'liza-viktor', 'device-1')).resolves.toEqual(activePayload);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_guest_bunker_v2_dashboard', {
      p_event_slug: 'liza-viktor',
      p_device_key: 'device-1',
    });
  });

  it('surfaces RPC errors without manufacturing a replacement snapshot', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'offline', code: '08006' } });
    await expect(getGuestBunkerV2Dashboard({ rpc }, 'liza-viktor', 'device-1')).rejects.toMatchObject({
      message: 'offline',
      code: '08006',
    });
  });
});
