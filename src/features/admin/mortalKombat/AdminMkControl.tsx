import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  setMkMainScreen,
  showMkBracket,
  type MkOwnerRpcClient,
  type MkResultResponse,
} from '../../mortalKombat/mk.owner.service';
import { MK_MAX_PLAYERS, type MkOwnerControl } from '../../mortalKombat/mk.types';
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

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 180);
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message.slice(0, 180);
  }
  return 'сервер отклонил команду';
}

export function AdminMkControl({ eventId, dependencies }: AdminMkControlProps) {
  const [state, setState] = useState<MkOwnerControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = async () => {
    const next = await dependencies.load(eventId);
    setState(next);
  };

  const refreshAll = async () => {
    let warning = '';
    try {
      await dependencies.broadcastRefresh();
    } catch {
      warning = 'Команда выполнена. Сигнал обновления не отправлен — экраны перечитают состояние автоматически.';
    }

    try {
      await reload();
    } catch {
      warning = warning || 'Команда выполнена, но не удалось перечитать состояние. Не нажимайте повторно — обновите страницу.';
    }

    if (warning) setError(warning);
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
    try {
      await setSharedProjector(true);
    } catch (projectorError) {
      setError(`Турнир запущен, но общий ТВ не переключился: ${errorMessage(projectorError)}. Сетка сохранена — повторно стартовать турнир не нужно.`);
    }
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
        if (active) setError('Не удалось загрузить турнирную арену.');
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
    } catch (commandError) {
      try {
        await reload();
      } catch {
        // The mutation error remains primary; a later poll or page refresh can still reconcile.
      }
      setError(`Команда турнира не выполнена: ${errorMessage(commandError)}. Состояние перечитано с сервера; не запускайте повторно, если турнир уже активен.`);
      setBusy(false);
      return;
    }

    await refreshAll();
    setBusy(false);
  };

  if (!state) {
    return (
      <section className="admin-mk-control">
        <p className="eyebrow">АРЕНА · ПОСЛЕДНИЙ КРУГ</p>
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
            <p className="eyebrow">ДО {MK_MAX_PLAYERS} ИГРОКОВ · OWNER CONTROL</p>
            <h2>ТУРНИРНЫЙ ПУЛЬТ</h2>
          </div>
          <span>НЕ ОТКРЫТ</span>
        </div>
        <button
          type="button"
          className="registration-submit"
          disabled={busy}
          onClick={() => void run(() => dependencies.open(eventId))}
        >
          ОТКРЫТЬ РЕГИСТРАЦИЮ ТУРНИРА
        </button>
      </section>
    );
  }

  const active = state.registrations.filter((registration) => registration.status === 'active');
  const waitlist = state.registrations.filter((registration) => registration.status === 'waitlist');
  const activeSeeds = active.map((registration) => registration.seed);
  const allSeeded = active.length >= 2
    && active.length <= state.maxPlayers
    && activeSeeds.every((seed) => seed !== null && seed >= 1 && seed <= active.length)
    && new Set(activeSeeds).size === active.length;
  const setupOpen = state.state === 'registration' || state.state === 'draw_ready';
  const needsReseed = state.state === 'draw_ready' && active.length >= 2 && !allSeeded;

  return (
    <section className="admin-mk-control">
      <div className="admin-mk-heading">
        <div>
          <p className="eyebrow">ДО {state.maxPlayers} ИГРОКОВ · OWNER CONTROL</p>
          <h2>ТУРНИРНЫЙ ПУЛЬТ</h2>
        </div>
        <span>{state.state.toUpperCase()}</span>
      </div>

      <div className="admin-mk-stats">
        <div><span>ОСНОВНАЯ СЕТКА</span><strong>{state.activeCount} / {state.maxPlayers}</strong></div>
        <div><span>ЛИСТ ОЖИДАНИЯ</span><strong>{state.waitlistCount}</strong></div>
        <div><span>БОЁВ</span><strong>{Math.max(state.activeCount - 1, 0)}</strong></div>
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
              ПЕРЕМЕШАТЬ {active.length} ИГРОКОВ
            </button>
            {state.state === 'registration' && (
              <button
                type="button"
                className="registration-secondary"
                disabled={busy || active.length < 2}
                onClick={() => void run(() => dependencies.close(eventId))}
              >
                ЗАКРЫТЬ РЕГИСТРАЦИЮ ТУРНИРА
              </button>
            )}
            {state.state === 'draw_ready' && active.length < 2 && (
              <button
                type="button"
                className="registration-secondary"
                disabled={busy}
                onClick={() => void run(() => dependencies.open(eventId))}
              >
                ВОЗОБНОВИТЬ РЕГИСТРАЦИЮ
              </button>
            )}
          </div>

          {needsReseed && (
            <p className="admin-mk-reseed-note" role="status">
              СОСТАВ ИЗМЕНИЛСЯ · нажмите «ПЕРЕМЕШАТЬ {active.length} ИГРОКОВ» или расставьте позиции заново перед стартом.
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
                    disabled={busy || state.activeCount >= state.maxPlayers}
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

          {(state.state === 'draw_ready' || (state.state === 'registration' && active.length < 2)) && (
            <div className="admin-mk-launch">
              <p>
                {active.length === 0
                  ? 'ЖДЁМ ИГРОКОВ · регистрация открыта, сетка пока не запускается.'
                  : active.length === 1
                    ? 'НУЖЕН ЕЩЁ ОДИН ИГРОК · турнир можно запустить от двух участников.'
                    : allSeeded
                      ? `${active.length} игроков расставлены. Старт создаст сетку (${active.length - 1} реальных боёв) и выведет её на главный ТВ.`
                      : `Расставьте уникальные позиции для всех игроков перед стартом. Поддерживается от 2 до ${state.maxPlayers} участников.`}
              </p>
              <button
                type="button"
                className="registration-submit"
                disabled={busy || !allSeeded}
                onClick={() => void run(startTournament)}
              >
                ЗАПУСТИТЬ ТУРНИР · {active.length} ИГРОКОВ
              </button>
            </div>
          )}
        </>
      )}

      {!setupOpen && (
        <>
          <div className="admin-mk-live-note">
            <strong>{state.state === 'complete' ? 'ТУРНИР ЗАВЕРШЁН' : 'СЕТКА ЗАФИКСИРОВАНА'}</strong>
            <p>Арену можно показывать на общем ТВ только в нужный момент. Отдельный экран турнира продолжает работать независимо.</p>
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
