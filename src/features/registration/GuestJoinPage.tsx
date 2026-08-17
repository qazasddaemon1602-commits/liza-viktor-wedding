import { useMemo } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { JoinPage, type JoinPageDependencies } from './JoinPage';
import {
  registerGuest,
  restoreGuest,
  type RegistrationRpcClient,
} from './registration.service';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

type GuestJoinPageProps = {
  client?: RegistrationRpcClient;
  eventSlug?: string;
  deviceKey?: string;
  revealDelayMs?: number;
};

function browserRegistrationClient(): RegistrationRpcClient {
  const supabase = getSupabaseClient();
  return {
    rpc: async (name, args) => {
      const { data, error } = await supabase.rpc(name as never, args as never);
      return { data, error };
    },
  };
}

export function GuestJoinPage({
  client,
  eventSlug = DEFAULT_EVENT_SLUG,
  deviceKey,
  revealDelayMs,
}: GuestJoinPageProps) {
  const dependencies = useMemo<JoinPageDependencies>(() => {
    const registrationClient = client ?? browserRegistrationClient();
    let cachedDeviceKey = deviceKey;
    const getDeviceKey = () => {
      cachedDeviceKey ??= getOrCreateDeviceKey();
      return cachedDeviceKey;
    };

    return {
      getDeviceKey,
      restore: (key) => restoreGuest(registrationClient, eventSlug, key),
      register: (draft, confirmDuplicate) => registerGuest(
        registrationClient,
        eventSlug,
        getDeviceKey(),
        draft,
        confirmDuplicate,
      ),
    };
  }, [client, deviceKey, eventSlug]);

  return <JoinPage dependencies={dependencies} revealDelayMs={revealDelayMs} />;
}
