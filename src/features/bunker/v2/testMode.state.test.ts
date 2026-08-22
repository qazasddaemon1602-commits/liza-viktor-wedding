import { describe, expect, it, vi } from 'vitest';
import { getOwnerTestModeState } from './testMode.service';

describe('Bunker V2 rehearsal state', () => {
  it('loads the persisted server mode instead of guessing from the UI', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      gameMode: 'test', globalState: 'MISSION_03', runActive: true, guestCount: 20, wagonCount: 3,
    }, error: null });
    const state = await getOwnerTestModeState({ rpc }, 'event-1');
    expect(rpc).toHaveBeenCalledWith('get_owner_bunker_v2_test_state', { p_event_id: 'event-1' });
    expect(state).toEqual({ gameMode: 'test', globalState: 'MISSION_03', runActive: true, guestCount: 20, wagonCount: 3 });
  });

  it('rejects unknown stages and inconsistent active-run state', async () => {
    await expect(getOwnerTestModeState({ rpc: vi.fn().mockResolvedValue({ data: {
      gameMode: 'test', globalState: 'MISSION_99', runActive: true, guestCount: 20, wagonCount: 3,
    }, error: null }) }, 'event-1')).rejects.toThrow(/stage/i);

    await expect(getOwnerTestModeState({ rpc: vi.fn().mockResolvedValue({ data: {
      gameMode: 'idle', globalState: 'LOBBY', runActive: false, guestCount: 0, wagonCount: 5,
    }, error: null }) }, 'event-1')).rejects.toThrow(/run state/i);
  });

  it('rejects impossible rehearsal counters', async () => {
    await expect(getOwnerTestModeState({ rpc: vi.fn().mockResolvedValue({ data: {
      gameMode: 'idle', globalState: null, runActive: false, guestCount: 41, wagonCount: 6,
    }, error: null }) }, 'event-1')).rejects.toThrow(/counters/i);
  });
});
