import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { CapsuleShowcaseOverlay } from './CapsuleShowcaseOverlay';
import {
  subscribeToCapsuleShowcase,
  type CapsuleShowcaseScreenEvent,
} from './messageCapsule.service';
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
  subscribeCapsule?: (callback: (event: CapsuleShowcaseScreenEvent) => void) => () => void;
  ttlMs?: number;
};

function browserReactionSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: GuestReactionScreenEvent) => void) => (
    subscribeToGuestReactions(client, eventSlug, callback)
  );
}

function browserCapsuleSubscribe(eventSlug: string) {
  const client = getSupabaseClient() as unknown as WeddingLiveRealtimeClient;
  return (callback: (event: CapsuleShowcaseScreenEvent) => void) => (
    subscribeToCapsuleShowcase(client, eventSlug, callback)
  );
}

const noCapsuleSubscribe = () => () => undefined;

export function WeddingLiveProjectorLayer({
  eventSlug = 'liza-viktor',
  children,
  subscribe,
  subscribeCapsule,
  ttlMs = 2800,
}: Props) {
  const resolvedSubscribe = useMemo(
    () => subscribe ?? browserReactionSubscribe(eventSlug),
    [eventSlug, subscribe],
  );
  const resolvedCapsuleSubscribe = useMemo(
    () => subscribeCapsule ?? (subscribe ? noCapsuleSubscribe : browserCapsuleSubscribe(eventSlug)),
    [eventSlug, subscribe, subscribeCapsule],
  );
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [capsule, setCapsule] = useState<CapsuleShowcaseScreenEvent | null>(null);

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

  useEffect(() => resolvedCapsuleSubscribe((event) => setCapsule(event)), [resolvedCapsuleSubscribe]);

  useEffect(() => {
    if (!bursts.length) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setBursts((current) => current.filter((burst) => burst.expiresAt > now));
    }, 250);
    return () => window.clearInterval(interval);
  }, [bursts.length]);

  useEffect(() => {
    if (!capsule) return;
    const duration = Math.min(58_000, capsule.messages.length * 5_500 + 900);
    const timer = window.setTimeout(() => {
      setCapsule((current) => current?.id === capsule.id ? null : current);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [capsule]);

  return (
    <>
      {children}
      {capsule && <CapsuleShowcaseOverlay messages={capsule.messages} />}
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
