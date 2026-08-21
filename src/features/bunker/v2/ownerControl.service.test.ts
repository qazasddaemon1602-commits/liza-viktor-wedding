import { describe, expect, it, vi } from 'vitest';
import { prepareOwnerBunkerV2, transitionOwnerBunkerV2 } from './ownerControl.service';

const prepared = {
  status: 'prepared',
  eventId: '41000000-0000-4000-8000-000000000001',
  runNonce: '41000000-0000-4000-8000-000000000002',
  contractVersion: 2,
  planVersion: 1,
  globalGameState: 'LOBBY',
  wagonCount: 2,
  guestCount: 15,
  missionInstanceCount: 12,
};

const transitioned = {
  status: 'transitioned',
  runNonce: '41000000-0000-4000-8000-000000000002',
  contractVersion: 2,
  previousState: 'LOBBY',
  globalGameState: 'CHARACTERS_READY',
  changed: true,
};

describe('Bunker V2 owner controls', () => {
  it('sends unique command IDs to prepare and transition and returns strict typed receipts', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: prepared, error: null })
      .mockResolvedValueOnce({ data: transitioned, error: null });

    await expect(prepareOwnerBunkerV2({ rpc }, prepared.eventId)).resolves.toEqual(prepared);
    await expect(transitionOwnerBunkerV2(
      { rpc }, prepared.eventId, 'CHARACTERS_READY',
    )).resolves.toEqual(transitioned);

    const prepareCommandId = rpc.mock.calls[0]?.[1].p_command_id;
    const transitionCommandId = rpc.mock.calls[1]?.[1].p_command_id;
    expect(prepareCommandId).toEqual(expect.any(String));
    expect(transitionCommandId).toEqual(expect.any(String));
    expect(prepareCommandId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(transitionCommandId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(transitionCommandId).not.toBe(prepareCommandId);
    expect(rpc).toHaveBeenNthCalledWith(1, 'owner_prepare_bunker_v2', {
      p_event_id: prepared.eventId,
      p_command_id: prepareCommandId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'owner_transition_bunker_v2', {
      p_event_id: prepared.eventId,
      p_next_state: 'CHARACTERS_READY',
      p_command_id: transitionCommandId,
    });
  });

  it('rejects a receipt with an extra client-unowned field', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ...prepared, clientProgress: 100 }, error: null,
    });

    await expect(prepareOwnerBunkerV2({ rpc }, prepared.eventId))
      .rejects.toThrow(/owner prepare receipt/i);
  });

  it('rejects receipts that do not correlate to the requested event and transition', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: { ...prepared, eventId: '41000000-0000-4000-8000-000000000099' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...transitioned, globalGameState: 'MISSION_01' },
        error: null,
      });

    await expect(prepareOwnerBunkerV2({ rpc }, prepared.eventId))
      .rejects.toThrow(/correlation/i);
    await expect(transitionOwnerBunkerV2(
      { rpc }, prepared.eventId, 'CHARACTERS_READY',
    )).rejects.toThrow(/correlation/i);
  });
});
