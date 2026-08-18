import type { CarriageSummary } from '../registration/registration.types';

export type CarriageCallRpcError = Error | { message?: string; code?: string } | null;

export type CarriageCallRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: CarriageCallRpcError }>;
};

export type OwnerCarriageCall = {
  callId: string;
  message: string;
  targetCarriageIds: string[];
  showOnScreen: boolean;
  createdAt: string;
};

export type PublishedCarriageCall = {
  status: 'published';
  screenEventId: string;
};

export type GuestCarriageCall = {
  id: string;
  message: string;
  showOnScreen: boolean;
  createdAt: string;
};

export type GuestActiveCarriageCalls =
  | { status: 'not_found'; calls: [] }
  | { status: 'ok'; carriage: CarriageSummary; calls: GuestCarriageCall[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function throwRpcError(error: Exclude<CarriageCallRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Carriage call request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function sendCarriageCall(
  client: CarriageCallRpcClient,
  eventId: string,
  carriageIds: string[],
  message: string,
  showOnScreen: boolean,
): Promise<OwnerCarriageCall> {
  const { data, error } = await client.rpc('owner_send_carriage_call', {
    p_event_id: eventId,
    p_carriage_ids: carriageIds,
    p_message: message,
    p_show_on_screen: showOnScreen,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'sent'
    || typeof data.callId !== 'string'
    || typeof data.message !== 'string'
    || !Array.isArray(data.targetCarriageIds)
    || typeof data.showOnScreen !== 'boolean'
    || typeof data.createdAt !== 'string'
  ) {
    throw new Error('Unexpected carriage-call response');
  }

  return {
    callId: data.callId,
    message: data.message,
    targetCarriageIds: data.targetCarriageIds.map(String),
    showOnScreen: data.showOnScreen,
    createdAt: data.createdAt,
  };
}

export async function clearCarriageCall(
  client: CarriageCallRpcClient,
  callId: string,
): Promise<void> {
  const { data, error } = await client.rpc('owner_clear_carriage_call', {
    p_call_id: callId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'cleared') {
    throw new Error('Unexpected carriage-call clear response');
  }
}

export async function publishCarriageCallToScreen(
  client: CarriageCallRpcClient,
  callId: string,
): Promise<PublishedCarriageCall> {
  const { data, error } = await client.rpc('owner_publish_carriage_call_screen_event', {
    p_call_id: callId,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'published'
    || typeof data.screenEventId !== 'string'
  ) {
    throw new Error('Unexpected carriage-call projector response');
  }

  return {
    status: 'published',
    screenEventId: data.screenEventId,
  };
}

export async function getGuestActiveCarriageCalls(
  client: CarriageCallRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<GuestActiveCarriageCalls> {
  const { data, error } = await client.rpc('get_guest_active_carriage_calls', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string' || !Array.isArray(data.calls)) {
    throw new Error('Unexpected guest carriage-call response');
  }

  if (data.status === 'not_found') return { status: 'not_found', calls: [] };
  if (data.status !== 'ok' || !isRecord(data.carriage)) {
    throw new Error('Unexpected guest carriage-call response');
  }

  const carriage = data.carriage as unknown as CarriageSummary;
  const calls = data.calls.map((call) => {
    if (!isRecord(call)) throw new Error('Unexpected carriage call item');
    return {
      id: String(call.id),
      message: String(call.message),
      showOnScreen: Boolean(call.showOnScreen),
      createdAt: String(call.createdAt),
    } satisfies GuestCarriageCall;
  });

  return { status: 'ok', carriage, calls };
}
