import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  setMkMainScreen,
  showMkBracket,
  type MkOwnerRpcClient,
  type MkResultResponse,
} from '../../mortalKombat/mk.owner.service';
import type { MkOwnerControl } from '../../mortalKombat/mk.types';
import { MatchEditor } from './MatchEditor';
import { PlayerPoolEditor } from './PlayerPoolEditor';

export type AdminMkControlDependencies = {
  load: (eventId: string) => Promise<MkOwnerControl>;
  open: (eventId: string) => Promise<void>;
  close: (eventId: string) => Promise<void>;
  randomize: (eventId: string) => Promise<void>;
  swap: (registrationA: string, registrationB: string) => Promise<void>;
  remove: (registrationId: string) => Promise<void>;
  promote: (registrationId: string) => Promise<void>;
  finalize: (eventId: string) => Promise<void>;
  setCurrent: (matchId: string) => Promise<void>;
  showBracket?: (eventId: string) => Promise<void>;
  setMainScreen?: (eventId: string, enabled: boolean) => Promise<void>;
  recordWinner: (matchId: string, winnerGuestId: string, clearDownstream: boolean) => Promise<MkResultResponse>;
  undo: (matchId: string, clearDownstream: boolean) => Promise<MkResultResponse>;
  broadcastRefresh: () => Promise<void>;
};

type AdminMkControlProps = {
  eventId: string;
  dependencies: AdminMkControlDependencies;
};

export function AdminMkControl({ eventId, dependencies }: AdminMkControlProps) {
  const [state, setState] = useState<MkOwnerControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = async () => {
    const next = await dependencies.load(eventId);
    setState(next);
  };

  const refreshAll = async () => {
    await dependencies.broadcastRefresh();
    await reload();
  };

  const setSharedProjector = async (enabled: boolean) => {
    if (dependencies.setMainScreen) {
      await dependencies.setMainScreen(eventId, enabled);
      return;
    }
    const client = getSupabaseClient() as unknown as MkOwnerRpcClient;
    await setMkMainScreen(client, eventId, enabled);
  };

  const showBracketOnProjector = async () => {
    if (dependencies.showBracket) {
      await dependencies.showBracket(eventId);
    } else {
      const client = getSupabaseClient() as unknown as MkOwnerRpcClient;
      await showMkBracket(client, eventId);
    }
    await setSharedProjector(true);
  };

  const startTournament = async () => {
    await dependencies.finalize(eventId);
    await setSharedProjector(true);
  };

  const setCurrentOnProjector = async (matchId: string) => {
    await dependencies.setCurrent(matchId);
    await setSharedProjector(true);
  };

  useEffect(() => {
    let active = true;
    void dependencies.load(eventId)
      .then((next) => {
        if (active) setState(next);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить Mortal Kombat.');
      });
    return () => {
      active = false;
    };
  }, [dependencies, eventId]);

  const run = async (command: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await command();
      await refreshAll();
    } catch {
      setError('Команда MK не выполнена. Проверьте состояние турнира и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <section className="admin-mk-control">
        <p className="eyebrow">MORTAL KOMBAT</p>
        <h2>ЗАГРУЖАЕМ АРЕНУ…</h2>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  if (state.status === 'idle') {
    return (
      <section className="admin-mk-control">
        <div className="admin-mk-heading">
          <div>
            <p className="eyebrow">16 ИГРОКОВ · OWNER CONTROL</p>
            <h2>MORTAL KOMBAT · ПУЛЬТ</h2>
          </div>
          <span>НЕ ОТКРЫТ</span>
        </div>
        <button
          type="button"
          className="registration-submit"
          disabled={busy}
          onClick={() => void run(() => dependencies.open(eventId))}
        >
          ОТКРЫТЬ РЕГИСТРАЦИЮ MK
        </button>
      </section>
    );
  }

  const active = state.registrations.filter((registration) => registration.status === 'active');
  const waitlist = state.registrations.filter((registration) => registration.status === 'waitlist');
  const allSeeded = active.length === 16 && active.every((registration) => registration.seed !== null);
  const setupOpen = state.state === 'registration' || state.state === 'draw_ready';
  const needsReseed = state.state === 'draw_ready' && active.length === 16 && !allSeeded;

  return (
    <section className="admin-mk-control">
      <div className="admin-mk-heading">
        <div>
          <p className="eyebrow">16 ИГРОКОВ · OWNER CONTROL</p>
          <h2>MORTAL KOMBAT · ПУЛЬТ</h2>
        </div>
        <span>{state.state.toUpperCase()}</span>
      </div>

      <div className="admin-mk-stats">
        <div><span>ОСНОВНАЯ СЕТКА</span><strong>{state.activeCount} / 16</strong></div>
        <div><span>ЛИСТ ОЖИДАНИЯ</span><strong>{state.waitlistCount}</strong></div>
        <div><span>МАТЧЕЙ</span><strong>{state.matches.length} / 15</strong></div>
      </div>

      {setupOpen && (
        <>
          <div className="admin-mk-actions">
            <button
              type="button"
              className="registration-secondary"
              disabled={busy || active.length < 2}
              onClick={() => void run(() => dependencies.randomize(eventId))}
            >
              ПЕРЕМЕШАТЬ 16 ИГРОКОВ
            </button>
            {state.state === 'registration' && (
              <button
                type="button"
                className="registration-secondary"
                disabled={busy}
                onClick={() => void run(() => dependencies.close(eventId))}
              >
                ЗАКРЫТЬ РЕГИСТРАЦИЮ MK
              </button>
            )}
          </div>

          {needsReseed && (
            <p className="admin-mk-reseed-note" role="status">
              СОСТАВ ИЗМЕНИЛСЯ · нажмите «ПЕРЕМЕШАТЬ 16 ИГРОКОВ» или расставьте позиции заново перед стартом.
            </p>
          )}

          <PlayerPoolEditor
            registrations={active}
            disabled={busy}
            onSwap={(registrationA, registrationB) => run(() => dependencies.swap(registrationA, registrationB))}
            onRemove={(registrationId) => run(() => dependencies.remove(registrationId))}
          />

          {waitlist.length > 0 && (
            <div className="admin-mk-waitlist">
              <h3>ЛИСТ ОЖИДАНИЯ</h3>
              {waitlist.map((registration, index) => (
                <article key={registration.registrationId}>
                  <span>#{index + 1}</span>
                  <strong>{registration.displayName}</strong>
                  <button
                    type="button"
                    className="registration-secondary"
                    disabled={busy || state.activeCount >= 16}
                    onClick={() => void run(() => dependencies.promote(registration.registrationId))}
                  >
                    В ОСНОВНУЮ СЕТКУ
                  </button>
                  <button
                    type="button"
                    className="registration-secondary"
                    disabled={busy}
                    onClick={() => void run(() => dependencies.remove(registration.registrationId))}
                  >
                    УБРАТЬ
                  </button>
                </article>
              ))}
            </div>
          )}

          {state.state === 'draw_ready' && (
            <div className="admin-mk-launch">
              <p>
                {allSeeded
                  ? '16 игроков расставлены. Старт создаст 15 серверных матчей и выведет сетку на главный ТВ.'
                  : 'Для старта нужны ровно 16 игроков и позиции #1–#16.'}
              </p>
              <button
                type="button"
                className="registration-submit"
                disabled={busy || !allSeeded}
                onClick={() => void run(startTournament)}
              >
                ЗАПУСТИТЬ ТУРНИР
              </button>
            </div>
          )}
        </>
      )}

      {!setupOpen && (
        <>
          <div className="admin-mk-live-note">
            <strong>{state.state === 'complete' ? 'ТУРНИР ЗАВЕРШЁН' : 'СЕТКА ЗАФИКСИРОВАНА'}</strong>
            <p>MK можно показывать на общем ТВ только в нужный момент. Отдельный MK-экран продолжает работать независимо.</p>
            <div className="admin-mk-actions">
              <button
                type="button"
                className="registration-secondary"
                disabled={busy}
                onClick={() => void run(showBracketOnProjector)}
              >
                ВЫВЕСТИ СЕТКУ НА ЭКРАНЫ
              </button>
              <button
                type="button"
                className="registration-secondary"
                disabled={busy}
                onClick={() => void run(() => setSharedProjector(false))}
              >
                ВЕРНУТЬ ГЛАВНЫЙ ЭКРАН
              </button>
            </div>
          </div>
          <MatchEditor
            matches={state.matches}
            registrations={state.registrations}
            onSetCurrent={setCurrentOnProjector}
            onRecordWinner={dependencies.recordWinner}
            onUndo={dependencies.undo}
            onChanged={refreshAll}
          />
        </>
      )}

      {error && <p className="admin-mk-error" role="alert">{error}</p>}
    </section>
  );
}
