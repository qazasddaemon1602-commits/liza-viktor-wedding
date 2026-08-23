import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { ChampionScene } from './ChampionScene';
import { MkFightScene } from './MkFightScene';
import { MkMilestoneScene } from './MkMilestoneScene';
import { deriveMkMilestone, type MkMilestone } from './mkMilestones';
import { subscribeToMkRefresh, type MkRealtimeClient } from './mk.realtime';
import { getMkTournamentDedicatedScreenState, type MkRpcClient } from './mk.service';
import type { MkTournamentProjection } from './mk.types';
import { PublicBracket } from './PublicBracket';
import { useMkRecovery } from './useMkRecovery';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

export type MkScreenPageDependencies = {
  load: () => Promise<MkTournamentProjection>;
  subscribeToRefresh?: (callback: () => void) => () => void;
  pollIntervalMs?: number;
};

type MkScreenPageProps = {
  eventSlug?: string;
  dependencies?: MkScreenPageDependencies;
};

function MkProjectorWaiting({ title }: { title: string }) {
  return (
    <section className="mk-screen-scene mk-screen-waiting" data-testid="mk-projector-waiting">
      <picture className="mk-projector-waiting-art" aria-hidden="true">
        <source type="image/avif" srcSet="/images/tournament/arena-wide-960.avif 960w, /images/tournament/arena-wide-1672.avif 1672w" sizes="100vw" />
        <source type="image/webp" srcSet="/images/tournament/arena-wide-960.webp 960w, /images/tournament/arena-wide-1672.webp 1672w" sizes="100vw" />
        <img data-testid="mk-projector-waiting-art" src="/images/tournament/arena-wide.png" alt="" />
      </picture>
      <div className="mk-projector-waiting-copy">
        <p className="eyebrow">СВАДЕБНЫЙ ТУРНИРНЫЙ АРХИВ</p>
        <h1>{title}</h1>
        <p>ЭКРАН ГОТОВ · ОЖИДАЕМ КОМАНДУ</p>
      </div>
    </section>
  );
}

function browserDependencies(eventSlug: string): MkScreenPageDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as MkRpcClient;
  const realtimeClient = client as unknown as MkRealtimeClient;
  return {
    load: () => getMkTournamentDedicatedScreenState(rpcClient, eventSlug),
    subscribeToRefresh: (callback) => subscribeToMkRefresh(realtimeClient, eventSlug, callback),
  };
}

export function MkScreenPage({ eventSlug = DEFAULT_EVENT_SLUG, dependencies }: MkScreenPageProps) {
  const deps = useMemo(() => dependencies ?? browserDependencies(eventSlug), [dependencies, eventSlug]);
  const [milestone, setMilestone] = useState<MkMilestone | null>(null);
  const previousStateRef = useRef<MkTournamentProjection | null>(null);
  const { state, stale } = useMkRecovery({
    scopeKey: eventSlug,
    load: deps.load,
    subscribe: deps.subscribeToRefresh,
    pollIntervalMs: deps.pollIntervalMs,
  });

  useEffect(() => {
    if (!state) return;
    const previous = previousStateRef.current;
    const nextMilestone = previous ? deriveMkMilestone(previous, state) : null;
    previousStateRef.current = state;
    if (nextMilestone) setMilestone(nextMilestone);
  }, [state]);

  useEffect(() => {
    previousStateRef.current = null;
    setMilestone(null);
  }, [eventSlug]);

  useEffect(() => {
    if (!milestone) return;
    const timeout = window.setTimeout(() => setMilestone(null), milestone.durationMs);
    return () => window.clearTimeout(timeout);
  }, [milestone]);

  if (!state) {
    return (
      <main className="mk-screen-page">
        <MkProjectorWaiting title="ГОТОВИМ АРЕНУ…" />
      </main>
    );
  }

  if (state.status !== 'active') {
    return (
      <main className="mk-screen-page">
        <MkProjectorWaiting title="ТУРНИР ЕЩЁ НЕ ОТКРЫТ" />
      </main>
    );
  }

  const currentMatch = state.matches.find((match) => match.current) ?? null;

  return (
    <main className="mk-screen-page">
      {milestone ? (
        <MkMilestoneScene milestone={milestone} />
      ) : state.state === 'complete' && state.championGuestId ? (
        <ChampionScene championGuestId={state.championGuestId} players={state.players} />
      ) : currentMatch ? (
        <MkFightScene match={currentMatch} players={state.players} />
      ) : (
        <PublicBracket state={state} displayMode="projector" />
      )}
      {stale && (
        <div className="screen-connection-indicator" role="status" aria-live="polite">
          СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ
        </div>
      )}
    </main>
  );
}

