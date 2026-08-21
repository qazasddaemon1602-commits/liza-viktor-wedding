import { describe, expect, it, vi } from 'vitest';
import type { BunkerRpcClient } from './bunker.service';
import {
  getOwnerBunkerCharacters,
  setOwnerBunkerCharacterStatus,
} from './bunkerCharacters.service';

function clientWith(data: unknown): BunkerRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

describe('owner Bunker character status service', () => {
  it('loads only owner-safe character summaries for the current run', async () => {
    const client = clientWith({
      status: 'active',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      characters: [{
        guestId: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
        realName: 'Сергей П.',
        wagon: { id: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6', number: 2, label: 'Вагон №2' },
        profession: 'МЕХАНИК',
        characterStatus: 'active',
        joinedLate: true,
      }],
      serverNow: '2026-08-20T18:00:00.000Z',
    });

    await expect(getOwnerBunkerCharacters(client, 'event-1')).resolves.toMatchObject({
      status: 'active',
      characters: [{
        realName: 'Сергей П.', characterStatus: 'active', joinedLate: true,
      }],
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_get_bunker_characters', {
      p_event_id: 'event-1',
    });
  });

  it('sets saved or excluded state through the owner RPC and parses the persisted result', async () => {
    const client = clientWith({
      status: 'updated',
      guestId: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
      characterStatus: 'saved',
      changed: true,
    });

    await expect(setOwnerBunkerCharacterStatus(
      client,
      'event-1',
      '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
      'saved',
    )).resolves.toEqual({
      status: 'updated',
      guestId: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
      characterStatus: 'saved',
      changed: true,
    });
    expect(client.rpc).toHaveBeenCalledWith('owner_set_bunker_character_status', {
      p_event_id: 'event-1',
      p_guest_id: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
      p_status: 'saved',
    });
  });

  it('rejects hidden traits and malformed status summaries at the service boundary', async () => {
    const client = clientWith({
      status: 'active',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      characters: [{
        guestId: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
        realName: 'Сергей П.',
        wagon: { id: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6', number: 2, label: 'Вагон №2' },
        profession: 'МЕХАНИК',
        characterStatus: 'active',
        joinedLate: false,
        hiddenTrait: 'СЕКРЕТ',
      }],
      serverNow: '2026-08-20T18:00:00.000Z',
    });

    await expect(getOwnerBunkerCharacters(client, 'event-1')).rejects.toThrow(/unexpected.*character/i);
  });

  it('does not invent a failed status outside the approved database enum', async () => {
    const client = clientWith({
      status: 'active',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      characters: [{
        guestId: '2c352a2a-15ee-4e0e-b50e-90c9a4490f42',
        realName: 'Сергей П.',
        wagon: {
          id: 'f8b201f3-23ae-4e32-b990-d3bed73d90d6',
          number: 2,
          label: 'Вагон №2',
        },
        profession: 'МЕХАНИК',
        characterStatus: 'failed',
        joinedLate: false,
      }],
      serverNow: '2026-08-20T18:00:00.000Z',
    });

    await expect(getOwnerBunkerCharacters(client, 'event-1')).rejects.toThrow(
      /unexpected.*character/i,
    );
  });
});
