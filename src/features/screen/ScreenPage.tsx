import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { IdleRegistrationScreen } from './IdleRegistrationScreen';
import {
  subscribeToScreenEvents,
  type ScreenEventsRealtimeClient,
} from './screenEvents.realtime';
import {
  TrainArrivalScene,
  type GuestRegistrationScreenEvent,
} from './TrainArrivalScene';

export type ScreenPageDependencies = {
  subscribe: (callback: (event: GuestRegistrationScreenEvent) => void) => () => void;
  playArrivalSignal?: () => void;
};

type ScreenPageProps = {
  joinUrl: string;
  eventSlug?: string;
  sceneDurationMs?: number;
  dependencies?: ScreenPageDependencies;
};

function browserDependencies(eventSlug: string): ScreenPageDependencies {
  const client = getSupabaseClient() as unknown as ScreenEventsRealtimeClient;
  return {
    subscribe: (callback) => subscribeToScreenEvents(client, eventSlug, callback),
  };
}

export function ScreenPage({
  joinUrl,
  eventSlug = 'liza-viktor',
  sceneDurationMs = 5600,
  dependencies,
}: ScreenPageProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [queue, setQueue] = useState<GuestRegistrationScreenEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<GuestRegistrationScreenEvent | null>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => deps.subscribe((event) => {
    if (seenIds.current.has(event.id)) return;
    seenIds.current.add(event.id);
    setQueue((current) => [...current, event]);
  }), [deps]);

  useEffect(() => {
    if (activeEvent || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActiveEvent(next);
  }, [activeEvent, queue]);

  useEffect(() => {
    if (!activeEvent) return;
    const timer = window.setTimeout(() => {
      setActiveEvent(null);
    }, sceneDurationMs);
    return () => window.clearTimeout(timer);
  }, [activeEvent, sceneDurationMs]);

  const playSignal = useCallback(() => {
    deps.playArrivalSignal?.();
  }, [deps]);

  return (
    <div className="screen-page">
      <IdleRegistrationScreen joinUrl={joinUrl} />
      {activeEvent && (
        <TrainArrivalScene
          event={activeEvent}
          onSignal={playSignal}
        />
      )}
    </div>
  );
}
