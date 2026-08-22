import { describe, expect, it, vi } from 'vitest';
import {
  accelerateTestTimer,
  fullEventReset,
  getOwnerTestModeState,
  prepareTestGame,
  resetGameAndRegistrations,
  seedTestGuests,
  setTestInventory,
  setTestWagonState,
  simulateTestStage,
} from './testMode.service';

function rpcMock(data: unknown = null) {
  return vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
    data,
    error: null,
  }));
}

describe('Bunker V2 test mode service', () => {
  it('seeds only supported rehearsal sizes', async () => {
    const rpc = rpcMock({ status: 'seeded', guestCount: 20, wagonCount: 3 });
    await seedTestGuests({ rpc }, 'event', 20);
    expect(rpc).toHaveBeenCalledWith('owner_bunker_v2_seed_test_guests', {
      p_event_id: 'event',
      p_count: 20,
    });
    await expect(seedTestGuests({ rpc }, 'event', 14)).rejects.toThrow(/15/);
  });

  it('parses real registrations separately even when an active rehearsal temporarily exceeds forty total rows', async () => {
    const rpc = rpcMock({
      gameMode: 'test',
      globalState: 'MISSION_03',
      runActive: true,
      guestCount: 41,
      realGuestCount: 21,
      wagonCount: 3,
    });

    await expect(getOwnerTestModeState({ rpc }, 'event')).resolves.toEqual({
      gameMode: 'test',
      globalState: 'MISSION_03',
      runActive: true,
      guestCount: 41,
      realGuestCount: 21,
      wagonCount: 3,
    });
  });

  it('keeps the rehearsal state reader compatible while the database migration is rolling out', async () => {
    const rpc = rpcMock({
      gameMode: 'idle',
      globalState: null,
      runActive: false,
      guestCount: 20,
      wagonCount: 3,
    });

    const state = await getOwnerTestModeState({ rpc }, 'event');
    expect(state.realGuestCount).toBe(20);
  });

  it('prepares a dedicated test run and never calls production prepare directly', async () => {
    const rpc = rpcMock({ status: 'prepared', gameMode: 'test' });
    await prepareTestGame({ rpc }, 'event', 'cmd');
    expect(rpc).toHaveBeenCalledWith('owner_prepare_bunker_v2_test', {
      p_event_id: 'event',
      p_command_id: 'cmd',
    });
  });

  it('exposes explicit test-only helpers', async () => {
    const rpc = rpcMock({ status: 'updated' });
    await accelerateTestTimer({ rpc }, 'event', 60);
    await simulateTestStage({ rpc }, 'event');
    await setTestInventory({ rpc }, 'event', 1, 'medkit', 2);
    await setTestWagonState({ rpc }, 'event', 1, {
      power: 'stable',
      communication: 'working',
      navigation: 'working',
    });
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it('rejects impossible wagon, inventory and timer values before transport', async () => {
    const rpc = rpcMock();
    await expect(setTestInventory({ rpc }, 'event', 6, 'medkit', 1)).rejects.toThrow(/wagon/i);
    await expect(setTestInventory({ rpc }, 'event', 1, 'mystery_box', 1)).rejects.toThrow(/inventory/i);
    await expect(setTestInventory({ rpc }, 'event', 1, 'water', 10)).rejects.toThrow(/quantity/i);
    await expect(accelerateTestTimer({ rpc }, 'event', 601)).rejects.toThrow(/600/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('requires destructive reset phrases before transport', async () => {
    const rpc = rpcMock();
    await expect(resetGameAndRegistrations({ rpc }, 'event', 'no')).rejects.toThrow(/confirmation/i);
    await expect(fullEventReset({ rpc }, 'event', 'no')).rejects.toThrow(/confirmation/i);
    expect(rpc).not.toHaveBeenCalled();
  });
});