import { type ReactNode, useMemo } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { GuestMessageCapsuleDock } from './GuestMessageCapsuleDock';
import {
  getGuestMessageCapsule,
  saveGuestMessageCapsule,
} from './messageCapsule.service';
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
  const live = useMemo(() => {
    const client = getSupabaseClient() as unknown as WeddingLiveRpcClient;
    const deviceKey = () => getOrCreateDeviceKey();
    return {
      onReact: (reaction: GuestReactionKey) => submitGuestReaction(
        client,
        eventSlug,
        deviceKey(),
        reaction,
      ),
      loadCapsule: () => getGuestMessageCapsule(client, eventSlug, deviceKey()),
      saveCapsule: (message: string) => saveGuestMessageCapsule(client, eventSlug, deviceKey(), message),
    };
  }, [eventSlug]);

  return (
    <>
      {children}
      <div className="guest-live-controls">
        <GuestMessageCapsuleDock load={live.loadCapsule} save={live.saveCapsule} />
        <GuestReactionDock onReact={live.onReact} />
      </div>
    </>
  );
}
