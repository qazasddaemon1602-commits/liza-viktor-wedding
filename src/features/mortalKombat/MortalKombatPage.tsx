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
          <p className="eyebrow">СВАДЕБНЫЙ ТУРНИРНЫЙ АРХИВ</p>
          <h1>ГОТОВИМ АРЕНУ…</h1>
        </section>
      </main>
    );
  }

  if (error && !state) {
    return (
      <main className="mk-page">
        <section className="mk-loading" role="alert">
          <p className="eyebrow">СВАДЕБНЫЙ ТУРНИРНЫЙ АРХИВ</p>
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
          <p className="eyebrow">СВАДЕБНЫЙ ТУРНИРНЫЙ АРХИВ</p>
          <h1>РЕГИСТРАЦИЯ ЕЩЁ НЕ ОТКРЫТА</h1>
          <p>Как только админ откроет набор бойцов, здесь появится кнопка участия.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mk-page">
      <header className="mk-hero">
        <picture className="mk-hero-art" aria-hidden="true">
          <source media="(max-width: 900px)" type="image/avif" srcSet="/images/tournament/arena-mobile-720.avif 720w, /images/tournament/arena-mobile-1086.avif 1086w" sizes="100vw" />
          <source media="(max-width: 900px)" type="image/webp" srcSet="/images/tournament/arena-mobile-720.webp 720w, /images/tournament/arena-mobile-1086.webp 1086w" sizes="100vw" />
          <source type="image/avif" srcSet="/images/tournament/arena-wide-960.avif 960w, /images/tournament/arena-wide-1672.avif 1672w" sizes="100vw" />
          <source type="image/webp" srcSet="/images/tournament/arena-wide-960.webp 960w, /images/tournament/arena-wide-1672.webp 1672w" sizes="100vw" />
          <img
            src="/images/tournament/arena-wide.png"
            alt=""
            width="1672"
            height="941"
            data-testid="tournament-hero-art"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <div className="mk-hero-copy">
          <div className="mk-hero-meta">
            <p className="eyebrow">ЛИЗА × ВИКТОР · 30.08.2026</p>
            <span>СВАДЕБНЫЙ ТУРНИРНЫЙ АРХИВ</span>
          </div>
          <h1 aria-label="АРЕНА ПОСЛЕДНИЙ КРУГ"><span>АРЕНА</span><br />ПОСЛЕДНИЙ КРУГ</h1>
          <p className="mk-hero-note">ДО {state.maxPlayers} БОЙЦОВ · ОДНА СЕТКА · ЖИВОЙ ФИНАЛ</p>
        </div>

        <div className="mk-hero-counter">
          <small>УЧАСТНИКИ</small>
          <strong>{state.activeCount}</strong>
          <span>/ {state.maxPlayers} БОЙЦОВ</span>
        </div>
      </header>

      <section className="mk-editorial-intro" aria-labelledby="mk-editorial-intro-title">
        <p className="eyebrow">АРХИВ 001 · ТЮМЕНЬ</p>
        <h2 id="mk-editorial-intro-title">ТУРНИР КАК ЖИВОЙ АРХИВ ВЕЧЕРА</h2>
        <p>
          Имена гостей, жеребьёвка и каждый результат остаются главным содержанием арены.
          Экран меняется вместе с ходом турнира и возвращается к текущему бою после потери связи.
        </p>
      </section>

      <MkSignupCard state={state} joining={joining} onJoin={() => void join()} />
      {error && <p className="mk-error" role="alert">{error}</p>}
      <PublicBracket state={state} />
    </main>
  );
}

