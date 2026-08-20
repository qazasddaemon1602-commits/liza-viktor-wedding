import { useEffect, useMemo, useState } from 'react';
import { getOrCreateDeviceKey } from '../../lib/deviceIdentity';
import { getSupabaseClient } from '../../lib/supabase';
import { broadcastMkRefresh, subscribeToMkRefresh, type MkRealtimeClient } from './mk.realtime';
import { getMkTournamentState, joinMkTournament, type MkRpcClient } from './mk.service';
import type { MkJoinResult, MkTournamentProjection } from './mk.types';
import { MkSignupCard } from './MkSignupCard';
import { PublicBracket } from './PublicBracket';

const DEFAULT_EVENT_SLUG = 'liza-viktor';

type ActiveMkTournamentProjection = Extract<MkTournamentProjection, { status: 'active' }>;

function isActiveTournament(
  projection: MkTournamentProjection,
): projection is ActiveMkTournamentProjection {
  return projection.status === 'active';
}

export type MortalKombatPageDependencies = {
  load: () => Promise<MkTournamentProjection>;
  join: () => Promise<MkJoinResult>;
  subscribeToRefresh?: (callback: () => void) => () => void;
};

type MortalKombatPageProps = {
  eventSlug?: string;
  dependencies?: MortalKombatPageDependencies;
};

function browserDependencies(eventSlug: string): MortalKombatPageDependencies {
  const client = getSupabaseClient();
  const rpcClient = client as unknown as MkRpcClient;
  const realtimeClient = client as unknown as MkRealtimeClient;
  const deviceKey = getOrCreateDeviceKey();

  return {
    load: () => getMkTournamentState(rpcClient, eventSlug, deviceKey),
    join: async () => {
      const result = await joinMkTournament(rpcClient, eventSlug, deviceKey);
      void broadcastMkRefresh(realtimeClient, eventSlug).catch(() => undefined);
      return result;
    },
    subscribeToRefresh: (callback) => subscribeToMkRefresh(realtimeClient, eventSlug, callback),
  };
}

export function MortalKombatPage({
  eventSlug = DEFAULT_EVENT_SLUG,
  dependencies,
}: MortalKombatPageProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [state, setState] = useState<MkTournamentProjection | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const reload = () => {
      void deps.load()
        .then((next) => {
          if (!active) return;
          setState(next);
          setError('');
        })
        .catch((loadError: unknown) => {
          if (!active) return;
          const code = typeof loadError === 'object' && loadError !== null && 'code' in loadError
            ? String((loadError as { code?: unknown }).code ?? '')
            : '';
          setError(code === '42501'
            ? 'Сначала зарегистрируйтесь гостем по QR-коду.'
            : 'Не удалось загрузить турнир. Проверьте связь.');
        });
    };

    reload();
    const unsubscribe = deps.subscribeToRefresh?.(reload);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [deps]);

  const join = async () => {
    if (joining) return;
    setJoining(true);
    setError('');
    try {
      await deps.join();
      setState(await deps.load());
    } catch (joinError) {
      const code = typeof joinError === 'object' && joinError !== null && 'code' in joinError
        ? String((joinError as { code?: unknown }).code ?? '')
        : '';
      setError(code === '42501'
        ? 'Сначала зарегистрируйтесь гостем по QR-коду.'
        : 'Не удалось добавить вас в турнир. Попробуйте ещё раз.');
    } finally {
      setJoining(false);
    }
  };

  if (!state && !error) {
    return (
      <main className="mk-page">
        <section className="mk-loading" aria-live="polite">
          <p className="eyebrow">MORTAL KOMBAT</p>
          <h1>ГОТОВИМ АРЕНУ…</h1>
        </section>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="mk-page">
        <section className="mk-loading" role="alert">
          <p className="eyebrow">MORTAL KOMBAT</p>
          <h1>АРЕНА ПОКА НЕДОСТУПНА</h1>
          <p>{error}</p>
          <a className="mk-primary-button" href="/join">ПЕРЕЙТИ К РЕГИСТРАЦИИ</a>
        </section>
      </main>
    );
  }

  if (!state || !isActiveTournament(state)) {
    return (
      <main className="mk-page">
        <section className="mk-loading">
          <p className="eyebrow">MORTAL KOMBAT</p>
          <h1>РЕГИСТРАЦИЯ ЕЩЁ НЕ ОТКРЫТА</h1>
          <p>Как только админ откроет набор бойцов, здесь появится кнопка участия.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mk-page">
      <header className="mk-hero">
        <div className="mk-hero-copy">
          <div className="mk-hero-meta">
            <p className="eyebrow">ЛИЗА × ВИКТОР · 30.08.2026</p>
            <span>WEDDING FIGHT ARCHIVE · EDITION 001</span>
          </div>
          <h1>MORTAL<br /><span>KOMBAT</span></h1>
          <p className="mk-hero-note">ДО 16 БОЙЦОВ · ONE BRACKET · LIVE ARENA</p>
        </div>

        <div className="mk-hero-figure" aria-hidden="true">
          <span className="mk-hero-figure__head" />
          <span className="mk-hero-figure__body" />
          <i>F-16</i>
        </div>

        <div className="mk-hero-counter">
          <small>FIGHTERS LOCKED</small>
          <strong>{state.activeCount}</strong>
          <span>/ 16 БОЙЦОВ</span>
        </div>
      </header>

      <MkSignupCard state={state} joining={joining} onJoin={() => void join()} />
      {error && <p className="mk-error" role="alert">{error}</p>}
      <PublicBracket state={state} />
    </main>
  );
}
