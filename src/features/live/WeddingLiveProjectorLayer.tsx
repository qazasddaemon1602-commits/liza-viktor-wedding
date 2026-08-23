import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  reactionEmoji,
  subscribeToGuestReactions,
  type GuestReactionKey,
  type GuestReactionScreenEvent,
  type WeddingLiveRealtimeClient,
} from './weddingLive.service';

type ReactionBurst = {
  reaction: GuestReactionKey;
  count: number;
  expiresAt: number;
  lastEventId: string;
};

type Props = {
  eventSlug?: string;
  children: ReactNode;
  subscribe?: (callback: (event: GuestReactionScreenEvent) => void) => () => void;
  ttlMs?: number;
};

function browserSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: GuestReactionScreenEvent) => void) => (
    subscribeToGuestReactions(client, eventSlug, callback)
  );
}

export function WeddingLiveProjectorLayer({
  eventSlug = 'liza-viktor',
  children,
  subscribe,
  ttlMs = 2800,
}: Props) {
  const resolvedSubscribe = useMemo(
    () => subscribe ?? browserSubscribe(eventSlug),
    [eventSlug, subscribe],
  );
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);

  useEffect(() => resolvedSubscribe((event) => {
    const now = Date.now();
    setBursts((current) => {
      const active = current.filter((burst) => burst.expiresAt > now);
      const existing = active.find((burst) => burst.reaction === event.reaction);
      if (existing) {
        return active.map((burst) => burst.reaction === event.reaction
          ? {
              ...burst,
              count: Math.min(99, burst.count + 1),
              expiresAt: now + ttlMs,
              lastEventId: event.id,
            }
          : burst);
      }
      return [
        ...active,
        {
          reaction: event.reaction,
          count: 1,
          expiresAt: now + ttlMs,
          lastEventId: event.id,
        },
      ].slice(-5);
    });
  }), [resolvedSubscribe, ttlMs]);

  useEffect(() => {
    if (bursts.length === 0) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setBursts((current) => current.filter((burst) => burst.expiresAt > now));
    }, 250);
    return () => window.clearInterval(interval);
  }, [bursts.length]);

  return (
    <>
      {children}
      <aside className="wedding-live-projector-layer" aria-live="polite" aria-label="Реакции гостей">
        {bursts.map((burst) => (
          <div
            key={`${burst.reaction}:${burst.lastEventId}`}
            className="wedding-live-reaction-burst"
          >
            <span aria-hidden="true">{reactionEmoji(burst.reaction)}</span>
            {burst.count > 1 && <strong>×{burst.count}</strong>}
          </div>
        ))}
      </aside>
    </>
  );
}
