import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import { subscribeToBunkerRefresh, type BunkerRealtimeClient } from '../bunker.realtime';
import { BunkerResultsPlayer } from './BunkerResultsPlayer';
import { getBunkerV2Results, type BunkerV2ResultsReadModel } from './results.service';
import type { BunkerV2RpcClient } from './command.service';

export type BunkerResultsLiveDependencies = {
  load: () => Promise<BunkerV2ResultsReadModel>;
  subscribe?: (callback: () => void) => () => void;
};

type Props = {
  eventSlug?: string;
  dependencies?: BunkerResultsLiveDependencies;
};

function browserDependencies(eventSlug: string): BunkerResultsLiveDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpc = client as unknown as BunkerV2RpcClient;
    const realtime = client as unknown as BunkerRealtimeClient;
    return {
      load: () => getBunkerV2Results(rpc, eventSlug),
      subscribe: (callback) => subscribeToBunkerRefresh(realtime, eventSlug, callback),
    };
  } catch {
    return null;
  }
}

export function BunkerResultsLivePlayer({ eventSlug = 'liza-viktor', dependencies }: Props) {
  const deps = useMemo(() => dependencies ?? browserDependencies(eventSlug), [dependencies, eventSlug]);
  const [result, setResult] = useState<BunkerV2ResultsReadModel | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!deps) return;
    try {
      const next = await deps.load();
      setResult(next);
      setError('');
    } catch {
      setError('Итоги ещё синхронизируются. Экран обновится автоматически.');
    }
  }, [deps]);

  useEffect(() => {
    if (!deps) return;
    void reload();
    const unsubscribe = deps.subscribe?.(() => void reload());
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 2_000);
    const recover = () => void reload();
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    return () => {
      unsubscribe?.();
      window.clearInterval(interval);
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
    };
  }, [deps, reload]);

  if (result?.status === 'completed') {
    const { contractVersion: _contractVersion, status: _status, serverNow: _serverNow, ...model } = result;
    return <BunkerResultsPlayer model={model} />;
  }

  return (
    <section className="bunker-v2-mission bunker-v2-results-player" aria-label="Итоги Бункера">
      <header className="bunker-v2-results-player__hero">
        <span>ФИНАЛ</span>
        <h1>БУНКЕР ОТКРЫТ</h1>
      </header>
      <p role="status">{error || 'Собираем итоги вашего состава…'}</p>
    </section>
  );
}
