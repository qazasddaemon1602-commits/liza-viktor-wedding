import { describe, expect, it, vi } from 'vitest';
import {
  applyCarriageDistribution,
  deleteGuest,
  issueGuestRecovery,
  loadOwnerDashboard,
  lockComposition,
  reassignGuest,
  resetEventTestData,
  type AdminRpcClient,
} from './admin.service';

function clientWith(data: unknown): AdminRpcClient {
  return { rpc: vi.fn().mockResolvedValue({ data, error: null }) };
}

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
    nextTicketSequence: 12,
  },
  state: {
    currentModule: 'idle',
    screenMode: 'idle',
    screenPinned: false,
    updatedAt: '2026-08-30T12:00:00+05:00',
  },
  carriages: [],
  guests: [],
  recentActions: [],
};

describe('admin service', () => {
  it('loads the private owner dashboard', async () => {
    const client = clientWith(dashboardPayload);

    const result = await loadOwnerDashboard(client, 'liza-viktor');

    expect(client.rpc).toHaveBeenCalledWith('owner_get_dashboard', {
      p_event_slug: 'liza-viktor',
    });
    expect(result.event.id).toBe('event-1');
  });

  it('deletes a guest only through the owner RPC', async () => {
    const client = clientWith({ status: 'deleted', guestId: 'g31' });

    await deleteGuest(client, 'g31');

    expect(client.rpc).toHaveBeenCalledWith('owner_delete_guest', {
      p_guest_id: 'g31',
    });
  });

  it('reassigns a guest only through the owner RPC', async () => {
    const client = clientWith({ status: 'updated' });

    await reassignGuest(client, 'g31', 'c2');

    expect(client.rpc).toHaveBeenCalledWith('owner_reassign_guest', {
      p_guest_id: 'g31',
      p_carriage_id: 'c2',
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

  it('applies the selected active carriage count atomically before locking composition', async () => {
    const client = clientWith({
      status: 'locked',
      activeCarriageCount: 3,
      registeredGuestCount: 20,
      carriageSizes: [7, 7, 6],
      registrationOpen: true,
    });

    const result = await applyCarriageDistribution(client, 'event-1', 3);

    expect(client.rpc).toHaveBeenCalledWith('owner_apply_carriage_distribution', {
      p_event_id: 'event-1',
      p_carriage_count: 3,
    });
    expect(result).toEqual({
      activeCarriageCount: 3,
      registeredGuestCount: 20,
      carriageSizes: [7, 7, 6],
      registrationOpen: true,
    });
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

  it('resets rehearsal runtime data only through the explicit owner reset RPC', async () => {
    const client = clientWith({
      status: 'reset',
      deletedGuests: 32,
      preservedCoupleAnswers: 30,
      premiereConfigured: true,
      mortalKombatReset: true,
      bunkerReset: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });

    const result = await resetEventTestData(client, 'event-1', 'СБРОСИТЬ');

    expect(client.rpc).toHaveBeenCalledWith('owner_reset_event_test_data', {
      p_event_id: 'event-1',
      p_confirmation: 'СБРОСИТЬ',
    });
    expect(result).toEqual({
      deletedGuests: 32,
      preservedCoupleAnswers: 30,
      premiereConfigured: true,
      mortalKombatReset: true,
      bunkerReset: true,
      registrationOpen: true,
      nextTicketSequence: 1,
    });
  });
});
