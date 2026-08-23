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
  reset: (eventId: string, confirmation: string) => Promise<void>;
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

function describeMkCommandError(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : '';

  const playerLimit = message.match(/between 2 and (\d+) active players required/)?.[1];
  if (playerLimit) {
    return `Для запуска нужно от 2 до ${playerLimit} участников.`;
  }
  if (message.includes('unique seed')) {
    return 'Перед запуском пережеребите турнир: у каждого участника должна быть своя позиция.';
  }
  if (message.includes('draw is already locked')) {
    return 'Сетка уже запущена. Для нового состава сначала сбросьте турнир.';
  }
  if (message.includes('Bunker emergency owns the shared projector')) {
    return 'Общий экран занят Бункером. Турнир можно открыть на отдельном экране.';
  }
  if (message.includes('Premiere owns the shared projector')) {
    return 'Общий экран занят премьерой. Турнир можно открыть на отдельном экране.';
  }
  if (message && /[А-Яа-яЁё]/.test(message)) return message;
  return message
    ? `Команда турнира не выполнена: ${message}`
    : 'Команда турнира не выполнена. Проверьте состояние и попробуйте ещё раз.';
}

export function AdminMkControl({ eventId, dependencies }: AdminMkControlProps) {
  const [state, setState] = useState<MkOwnerControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmingReroll, setConfirmingReroll] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');

  const reload = async () => {
    const next = await dependencies.load(eventId);
    setState(next);
  };

  const appendNotice = (message: string) => {
    setNotice((current) => current ? `${current} ${message}` : message);
  };

  const refreshAll = async () => {
    try {
      await dependencies.broadcastRefresh();
    } catch {
      appendNotice('Изменение сохранено, но автообновление экранов недоступно.');
    }
    try {
      await reload();
    } catch {
      appendNotice('Изменение сохранено, но состояние пульта не обновилось. Обновите страницу.');
    }
  };

  const setSharedProjector = async (enabled: boolean) => {
    if (dependencies.setMainScreen) {
      await dependencies.setMainScreen(eventId, enabled);
      return;
    }
    const client = getSupabaseClient() as unknown as MkOwnerRpcClient;
    await setMkMainScreen(client, eventId, enabled);
  };

  const claimSharedProjectorAfterMutation = async (committedMessage: string) => {
    try {
      await setSharedProjector(true);
    } catch (projectorError) {
      appendNotice(`${committedMessage} ${describeMkCommandError(projectorError)}`);
    }
  };

  const showBracketOnProjector = async () => {
    if (dependencies.showBracket) {
      await dependencies.showBracket(eventId);
    } else {
      const client = getSupabaseClient() as unknown as MkOwnerRpcClient;
      await showMkBracket(client, eventId);
    }
    await claimSharedProjectorAfterMutation('Сетка выбрана.');
  };

  const startTournament = async () => {
    await dependencies.finalize(eventId);
    await claimSharedProjectorAfterMutation('Турнир запущен.');
  };

  const setCurrentOnProjector = async (matchId: string) => {
    await dependencies.setCurrent(matchId);
    await claimSharedProjectorAfterMutation('Бой выбран.');
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
    setNotice('');
    try {
      await command();
      await refreshAll();
    } catch (commandError) {
      setError(describeMkCommandError(commandError));
    } finally {
      setBusy(false);
    }
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
  const activeSeeds = new Set(
    active
      .map((registration) => registration.seed)
      .filter((seed): seed is number => Number.isInteger(seed)),
  );
  const allSeeded = active.length >= 2
    && active.length <= state.maxPlayers
    && activeSeeds.size === active.length
    && Array.from({ length: active.length }, (_, index) => index + 1)
      .every((seed) => activeSeeds.has(seed));
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
              onClick={() => setConfirmingReroll(true)}
            >
              ПЕРЕЖЕРЕБИТЬ ТУРНИР
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

          {confirmingReroll && (
            <div className="admin-mk-live-note" role="alertdialog" aria-label="Подтверждение пережеребьёвки">
              <strong>СМЕНИТЬ ВСЕ ПОЗИЦИИ?</strong>
              <p>Состав участников сохранится. Изменится только порядок игроков до запуска турнира.</p>
              <div className="admin-mk-actions">
                <button
                  type="button"
                  className="registration-submit"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await dependencies.randomize(eventId);
                    setConfirmingReroll(false);
                  })}
                >
                  ПОДТВЕРДИТЬ ПЕРЕЖЕРЕБЬЁВКУ
                </button>
                <button
                  type="button"
                  className="registration-secondary"
                  disabled={busy}
                  onClick={() => setConfirmingReroll(false)}
                >
                  ОТМЕНА
                </button>
              </div>
            </div>
          )}

          {needsReseed && (
            <p className="admin-mk-reseed-note" role="status">
              СОСТАВ ИЗМЕНИЛСЯ · пережеребите турнир или расставьте позиции заново перед стартом.
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
          <div className="admin-mk-live-note">
            <strong>НОВЫЙ ТУРНИР</strong>
            <p>Сброс удалит только участников, сетку и результаты этого турнира.</p>
            <button
              type="button"
              className="registration-secondary"
              disabled={busy}
              onClick={() => setConfirmingReset(true)}
            >
              СБРОСИТЬ ТУРНИР
            </button>
          </div>

          {confirmingReset && (
            <div className="admin-mk-live-note" role="alertdialog" aria-label="Подтверждение сброса турнира">
              <strong>ДЕЙСТВИЕ НЕЛЬЗЯ ОТМЕНИТЬ</strong>
              <p>
                Будут удалены участники MK, сетка и результаты боёв. Регистрации гостей свадьбы и ответы пары сохранятся.
              </p>
              <label>
                <span>Введите СБРОСИТЬ ТУРНИР</span>
                <input
                  type="text"
                  value={resetConfirmation}
                  autoComplete="off"
                  onChange={(event) => setResetConfirmation(event.target.value)}
                />
              </label>
              <div className="admin-mk-actions">
                <button
                  type="button"
                  className="registration-submit"
                  disabled={busy || resetConfirmation !== 'СБРОСИТЬ ТУРНИР'}
                  onClick={() => void run(async () => {
                    await dependencies.reset(eventId, resetConfirmation);
                    setConfirmingReset(false);
                    setResetConfirmation('');
                  })}
                >
                  ПОДТВЕРДИТЬ СБРОС ТУРНИРА
                </button>
                <button
                  type="button"
                  className="registration-secondary"
                  disabled={busy}
                  onClick={() => {
                    setConfirmingReset(false);
                    setResetConfirmation('');
                  }}
                >
                  ОТМЕНА
                </button>
              </div>
            </div>
          )}
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
      {notice && <p className="admin-mk-reseed-note" role="status">{notice}</p>}
    </section>
  );
}
