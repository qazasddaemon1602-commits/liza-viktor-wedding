import type { RegistrationDraft } from './registrationModel';
import type { RegisteredGuest } from './registration.types';

type RpcError = Error | { message?: string } | null;

type RpcResponse = {
  data: unknown;
  error: RpcError;
};

export type RegistrationRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResponse>;
};

export type RegistrationResult =
  | { status: 'registered' | 'restored'; guest: RegisteredGuest }
  | { status: 'duplicate_warning'; publicName: string };

export type RestoreResult =
  | { status: 'restored'; guest: RegisteredGuest }
  | { status: 'not_found' };

function throwRpcError(error: Exclude<RpcError, null>): never {
  if (error instanceof Error) throw error;
  throw new Error(error.message || 'Registration request failed');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRegistrationResult(data: unknown): RegistrationResult {
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected registration response');
  }

  if (data.status === 'duplicate_warning' && typeof data.publicName === 'string') {
    return { status: 'duplicate_warning', publicName: data.publicName };
  }

  if ((data.status === 'registered' || data.status === 'restored') && isRecord(data.guest)) {
    return {
      status: data.status,
      guest: data.guest as RegisteredGuest,
    };
  }

  throw new Error('Unexpected registration response');
}

export async function registerGuest(
  client: RegistrationRpcClient,
  eventSlug: string,
  deviceKey: string,
  draft: RegistrationDraft,
  confirmDuplicate = false,
): Promise<RegistrationResult> {
  const { data, error } = await client.rpc('register_guest', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_first_name: draft.firstName,
    p_last_name: draft.lastName,
    p_affiliation_type: draft.affiliationType,
    p_affiliation_detail: draft.affiliationDetail,
    p_confirm_duplicate: confirmDuplicate,
  });

  if (error) throwRpcError(error);
  return parseRegistrationResult(data);
}

export async function restoreGuest(
  client: RegistrationRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<RestoreResult> {
  const { data, error } = await client.rpc('restore_guest', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });

  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected restore response');
  }

  if (data.status === 'not_found') return { status: 'not_found' };
  if (data.status === 'restored' && isRecord(data.guest)) {
    return { status: 'restored', guest: data.guest as RegisteredGuest };
  }

  throw new Error('Unexpected restore response');
}
