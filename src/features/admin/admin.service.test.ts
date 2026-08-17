import { describe, expect, it, vi } from 'vitest';
import {
  deleteGuest,
  issueGuestRecovery,
  loadOwnerDashboard,
  lockComposition,
  reassignGuest,
  type AdminRpcClient,
} from './admin.service';

const dashboardPayload = {
  status: 'owner',
  event: {
    id: 'event-1',
    slug: 'liza-viktor',
    name: 'Лиза × Виктор',
    weddingDate: '2026-08-29',
    eventDate: '2026-08-30',
    expectedGuestCount: 40,
    registrationOpen: true,
    compositionLocked: false,
    nextTicketSequence: 33,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: '2026-08-30T12:00:00+05:00',
  },
  carriages: [
    { id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03', enabled: true },
  ],
  guests: [
    {
      id: 'g31',
      firstName: 'Иван',
      lastName: 'Петров',
      affiliationType: 'viktor',
      affiliationDetail: 'коллега Виктора',
      ticketNumber: 'LV-031',
      registeredAt: '2026-08-30T12:01:00+05:00',
      lastSeenAt: '2026-08-30T12:05:00+05:00',
      carriage: { id: 'c3', number: 3, label: 'ВАГОН №3', accentHex: '#7E3F3C', visualMark: '03' },
    },
  ],
  recentActions: [],
};

function clientWith(data: unknown): AdminRpcClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('admin service', () => {
  it('bootstraps private owner dashboard with one protected RPC', async () => {
    const client = clientWith(dashboardPayload);

    const dashboard = await loadOwnerDashboard(client, 'liza-viktor');

    expect(client.rpc).toHaveBeenCalledWith('owner_get_dashboard', {
      p_event_slug: 'liza-viktor',
    });
    expect(dashboard.event.expectedGuestCount).toBe(40);
    expect(dashboard.guests[0].firstName).toBe('Иван');
    expect(dashboard.guests[0].carriage.label).toBe('ВАГОН №3');
  });

  it('deletes a duplicate only through the owner RPC', async () => {
    const client = clientWith({ status: 'deleted', guestId: 'g31' });

    await deleteGuest(client, 'g31');

    expect(client.rpc).toHaveBeenCalledWith('owner_delete_guest', {
      p_guest_id: 'g31',
    });
  });

  it('reassigns a guest only through the owner RPC', async () => {
    const client = clientWith({ status: 'updated' });

    await reassignGuest(client, 'g31', 'c4');

    expect(client.rpc).toHaveBeenCalledWith('owner_reassign_guest', {
      p_guest_id: 'g31',
      p_carriage_id: 'c4',
    });
  });

  it('locks existing carriage composition without closing registration', async () => {
    const client = clientWith({ status: 'locked', registrationOpen: true });

    const result = await lockComposition(client, 'event-1');

    expect(client.rpc).toHaveBeenCalledWith('owner_lock_composition', {
      p_event_id: 'event-1',
    });
    expect(result.registrationOpen).toBe(true);
  });

  it('issues a short-lived recovery code only through the owner RPC', async () => {
    const client = clientWith({
      status: 'issued',
      guestId: 'g31',
      code: 'AB12-CD34',
      expiresAt: '2026-08-30T12:15:00+05:00',
    });

    const result = await issueGuestRecovery(client, 'g31');

    expect(client.rpc).toHaveBeenCalledWith('owner_issue_guest_recovery', {
      p_guest_id: 'g31',
    });
    expect(result).toEqual({
      code: 'AB12-CD34',
      expiresAt: '2026-08-30T12:15:00+05:00',
    });
  });
});
