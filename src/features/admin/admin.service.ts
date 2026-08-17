import type { CarriageSummary } from '../registration/registration.types';

export type AdminRpcError = Error | { message?: string; code?: string } | null;

export type AdminRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: AdminRpcError }>;
};

export type AdminDashboardGuest = {
  id: string;
  firstName: string;
  lastName: string;
  affiliationType: string;
  affiliationDetail: string;
  ticketNumber: string;
  registeredAt: string;
  lastSeenAt: string;
  carriage: CarriageSummary;
};

export type AdminDashboard = {
  status: 'owner';
  event: {
    id: string;
    slug: string;
    name: string;
    weddingDate: string;
    eventDate: string;
    expectedGuestCount: number;
    registrationOpen: boolean;
    compositionLocked: boolean;
    nextTicketSequence: number;
  };
  state: {
    currentModule: string;
    screenMode: string;
    screenPinned: boolean;
    updatedAt: string;
  } | null;
  carriages: Array<CarriageSummary & { enabled: boolean }>;
  guests: AdminDashboardGuest[];
  recentActions: Array<{
    id: number;
    action: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

function throwRpcError(error: Exclude<AdminRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Owner request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDashboard(data: unknown): AdminDashboard {
  if (!isRecord(data) || data.status !== 'owner') {
    throw new Error('Unexpected owner dashboard response');
  }
  if (!isRecord(data.event) || !Array.isArray(data.carriages) || !Array.isArray(data.guests)) {
    throw new Error('Unexpected owner dashboard payload');
  }

  return data as unknown as AdminDashboard;
}

export async function loadOwnerDashboard(
  client: AdminRpcClient,
  eventSlug: string,
): Promise<AdminDashboard> {
  const { data, error } = await client.rpc('owner_get_dashboard', {
    p_event_slug: eventSlug,
  });
  if (error) throwRpcError(error);
  return parseDashboard(data);
}

export async function deleteGuest(
  client: AdminRpcClient,
  guestId: string,
): Promise<void> {
  const { error } = await client.rpc('owner_delete_guest', {
    p_guest_id: guestId,
  });
  if (error) throwRpcError(error);
}

export async function reassignGuest(
  client: AdminRpcClient,
  guestId: string,
  carriageId: string,
): Promise<void> {
  const { error } = await client.rpc('owner_reassign_guest', {
    p_guest_id: guestId,
    p_carriage_id: carriageId,
  });
  if (error) throwRpcError(error);
}

export async function lockComposition(
  client: AdminRpcClient,
  eventId: string,
): Promise<{ registrationOpen: boolean }> {
  const { data, error } = await client.rpc('owner_lock_composition', {
    p_event_id: eventId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'locked' || typeof data.registrationOpen !== 'boolean') {
    throw new Error('Unexpected composition-lock response');
  }
  return { registrationOpen: data.registrationOpen };
}
