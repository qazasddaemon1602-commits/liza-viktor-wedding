import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { ChampionScene } from './ChampionScene';
import { MkFightScene } from './MkFightScene';
import { subscribeToMkRefresh, type MkRealtimeClient } from './mk.realtime';
import { getMkTournamentScreenState, type MkRpcClient } from './mk.service';
import type { MkTournamentProjection } from './mk.types';
import { PublicBracket } from './PublicBracket';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

export type MkScreenPageDependencies = {
  load: () => Promise<MkTournamentProjection>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type MkScreenPageProps = {
  eventSlug?: string;
  dependencies?: MkScreenPageDependencies;
};

function browserDependencies(eventSlug: string): MkScreenPageDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as MkRpcClient;
  const realtimeClient = client as unknown as MkRealtimeClient;
  return {
    load: () => getMkTournamentScreenState(rpcClient, eventSlug),
    subscribeToRefresh: (callback) => subscribeToMkRefresh(realtimeClient, eventSlug, callback),
  };
}

export function MkScreenPage({ eventSlug = DEFAULT_EVENT_SLUG, dependencies }: MkScreenPageProps) {
  const deps = useMemo(() => dependencies ?? browserDependencies(eventSlug), [dependencies, eventSlug]);
  const [state, setState] = useState<MkTournamentProjection | null>(null);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    let active = true;
    const reload = () => {
      void deps.load()
        .then((next) => {
          if (!active) return;
          setState(next);
          setDegraded(false);
        })
        .catch(() => {
          if (active) setDegraded(true);
        });
    };

    reload();
    const unsubscribe = deps.subscribeToRefresh?.(reload);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps]);

  if (!state) {
    return (
      <main className="mk-screen-page">
        <section className="mk-screen-scene mk-screen-waiting">
          <p className="eyebrow">MORTAL KOMBAT</p>
          <h1>ГОТОВИМ АРЕНУ…</h1>
        </section>
      </main>
    );
  }

  if (state.status !== 'active') {
    return (
      <main className="mk-screen-page">
        <section className="mk-screen-scene mk-screen-waiting">
          <p className="eyebrow">MORTAL KOMBAT</p>
          <h1>ТУРНИР ЕЩЁ НЕ ОТКРЫТ</h1>
        </section>
      </main>
    );
  }

  const currentMatch = state.matches.find((match) => match.current) ?? null;

  return (
    <main className="mk-screen-page">
      {state.state === 'complete' && state.championGuestId ? (
        <ChampionScene championGuestId={state.championGuestId} players={state.players} />
      ) : currentMatch ? (
        <MkFightScene match={currentMatch} players={state.players} />
      ) : (
        <PublicBracket state={state} />
      )}
      {degraded && <div className="screen-connection-indicator">СВЯЗЬ · ПЕРЕПОДКЛЮЧЕНИЕ</div>}
    </main>
  );
}
