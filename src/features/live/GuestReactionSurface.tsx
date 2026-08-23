import { type ReactNode, useMemo } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { GuestReactionDock } from './GuestReactionDock';
import {
  submitGuestReaction,
  type GuestReactionKey,
  type WeddingLiveRpcClient,
} from './weddingLive.service';

type Props = {
  eventSlug?: string;
  children: ReactNode;
};

export function GuestReactionSurface({ eventSlug = 'liza-viktor', children }: Props) {
  const onReact = useMemo(() => {
    const client = getSupabaseClient() as unknown as WeddingLiveRpcClient;
    return (reaction: GuestReactionKey) => submitGuestReaction(
      client,
      eventSlug,
      getOrCreateDeviceKey(),
      reaction,
    );
  }, [eventSlug]);

  return (
    <>
      {children}
      <GuestReactionDock onReact={onReact} />
    </>
  );
}
