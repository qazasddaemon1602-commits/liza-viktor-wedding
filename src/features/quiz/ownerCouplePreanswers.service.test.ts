import { describe, expect, it, vi } from 'vitest';
import {
  getOwnerCouplePreanswerStatus,
  issueOwnerCouplePreanswerAccess,
  type OwnerCouplePreanswerRpcClient,
} from './ownerCouplePreanswers.service';

function clientWith(data: unknown): OwnerCouplePreanswerRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('owner couple preanswer service', () => {
  it('loads completion status without exposing answer values', async () => {
    const client = clientWith({
      status: 'active',
      answeredCount: 12,
      totalCount: 30,
      issuedAt: '2026-08-18T10:00:00Z',
      finalizedAt: null,
    });

    const result = await getOwnerCouplePreanswerStatus(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_get_couple_preanswer_status', {
      p_event_id: 'event-1',
    });
    expect(result).toEqual({
      status: 'active',
      answeredCount: 12,
      totalCount: 30,
      issuedAt: '2026-08-18T10:00:00Z',
      finalizedAt: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/liza|viktor|choice/i);
  });

  it('parses not-issued and finalized states', async () => {
    const notIssued = await getOwnerCouplePreanswerStatus(clientWith({
      status: 'not_issued',
      answeredCount: 0,
      totalCount: 30,
      issuedAt: null,
      finalizedAt: null,
    }), 'event-1');

    const finalized = await getOwnerCouplePreanswerStatus(clientWith({
      status: 'finalized',
      answeredCount: 30,
      totalCount: 30,
      issuedAt: '2026-08-18T10:00:00Z',
      finalizedAt: '2026-08-19T09:30:00Z',
    }), 'event-1');

    expect(notIssued.status).toBe('not_issued');
    expect(finalized.status).toBe('finalized');
  });

  it('issues a fresh one-time token through the owner-only RPC', async () => {
    const client = clientWith({ status: 'issued', token: 'secret-token' });

    const result = await issueOwnerCouplePreanswerAccess(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_issue_couple_preanswer_access', {
      p_event_id: 'event-1',
    });
    expect(result).toEqual({ status: 'issued', token: 'secret-token' });
  });

  it('rejects malformed status payloads', async () => {
    await expect(getOwnerCouplePreanswerStatus(clientWith({
      status: 'active',
      answeredCount: 31,
      totalCount: 30,
      issuedAt: null,
      finalizedAt: null,
    }), 'event-1')).rejects.toThrow('Unexpected owner couple preanswer response');
  });
});
