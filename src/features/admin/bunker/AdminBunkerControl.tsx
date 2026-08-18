import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  broadcastBunkerRefresh,
  type BunkerRealtimeClient,
} from '../../bunker/bunker.realtime';
import {
  getOwnerBunkerControl,
  setBunkerSound,
  startBunker,
  stopBunker,
  type BunkerRpcClient,
  type OwnerBunkerControl,
} from '../../bunker/bunker.service';

export type AdminBunkerControlDependencies = {
  load: (eventId: string) => Promise<OwnerBunkerControl>;
  start: (eventId: string, durationSeconds: number) => Promise<unknown>;
  stop: (eventId: string) => Promise<unknown>;
  setSound: (eventId: string, enabled: boolean) => Promise<unknown>;
  broadcastRefresh: () => Promise<void>;
};

type AdminBunkerControlProps = {
  eventId: string;
  dependencies?: AdminBunkerControlDependencies;
};

function browserDependencies(): AdminBunkerControlDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpcClient = client as unknown as BunkerRpcClient;
    const realtimeClient = client as unknown as BunkerRealtimeClient;
    return {
      load: (eventId) => getOwnerBunkerControl(rpcClient, eventId),
      start: (eventId, durationSeconds) => startBunker(rpcClient, eventId, durationSeconds),
      stop: (eventId) => stopBunker(rpcClient, eventId),
      setSound: (eventId, enabled) => setBunkerSound(rpcClient, eventId, enabled),
      broadcastRefresh: () => broadcastBunkerRefresh(realtimeClient, 'liza-viktor'),
    };
  } catch {
    return null;
  }
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function AdminBunkerControl({ eventId, dependencies }: AdminBunkerControlProps) {
  const deps = useMemo(() => dependencies ?? browserDependencies(), [dependencies]);
  const [state, setState] = useState<OwnerBunkerControl | null>(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const serverOffsetRef = useRef(0);

  const storeState = (next: OwnerBunkerControl) => {
    const receivedAt = Date.now();
    const serverMs = Date.parse(next.serverNow);
    serverOffsetRef.current = Number.isFinite(serverMs) ? serverMs - receivedAt : 0;
    setNowMs(receivedAt);
    setState(next);
  };

  const reload = async () => {
    if (!deps) return;
    storeState(await deps.load(eventId));
  };

  useEffect(() => {
    if (!deps) return;
    let active = true;
    void deps.load(eventId)
      .then((next) => {
        if (active) storeState(next);
      })
      .catch(() => {
        if (active) setError('Не удалось проверить статус Бункера.');
      });
    return () => {
      active = false;
    };
  }, [deps, eventId]);

  useEffect(() => {
    if (state?.status !== 'active') return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [state?.status]);

  if (!deps) return null;

  const remaining = state?.status === 'active'
    ? Math.max(
        0,
        Math.ceil(
          state.durationSeconds
          - (nowMs + serverOffsetRef.current - Date.parse(state.startedAt)) / 1000,
        ),
      )
    : 0;

  const run = async (command: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await command();
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Команда Бункера не выполнена. Проверьте связь и owner-доступ.');
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    await run(() => deps.start(eventId, 1800));
    setArmed(false);
  };

  return (
    <section className={`admin-bunker-control${state?.status === 'active' ? ' admin-bunker-control--active' : ''}`}>
      <div className="admin-bunker-control__heading">
        <div>
          <p className="eyebrow">СЮЖЕТНЫЙ ПОВОРОТ · OWNER ONLY</p>
          <h2>БУНКЕР</h2>
        </div>
        <strong>{state?.status === 'active' ? formatTimer(remaining) : 'ГОТОВ'}</strong>
      </div>

      <p className="admin-bunker-control__copy">
        Все ТВ переключатся на «ЭКСТРЕННОЕ СООБЩЕНИЕ», маршрут изменится на Бункер и запустится общий таймер 30:00.
      </p>

      {state?.status === 'active' ? (
        <div className="admin-bunker-control__actions">
          <button
            type="button"
            className="registration-secondary"
            disabled={busy}
            onClick={() => void run(() => deps.start(eventId, 1800))}
          >
            ПЕРЕЗАПУСТИТЬ 30:00
          </button>
          <button
            type="button"
            className="admin-bunker-stop"
            disabled={busy}
            onClick={() => void run(() => deps.stop(eventId))}
          >
            ОСТАНОВИТЬ БУНКЕР
          </button>
        </div>
      ) : armed ? (
        <div className="admin-bunker-confirm" role="alert">
          <strong>ВСЕ ЭКРАНЫ ПЕРЕКЛЮЧАТСЯ СРАЗУ</strong>
          <p>Проверьте, что ведущий готов и это нужный момент сценария.</p>
          <div>
            <button
              type="button"
              className="admin-bunker-launch"
              disabled={busy}
              onClick={() => void launch()}
            >
              {busy ? 'ЗАПУСКАЕМ…' : 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00'}
            </button>
            <button type="button" className="registration-secondary" disabled={busy} onClick={() => setArmed(false)}>
              ОТМЕНА
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="registration-secondary"
          onClick={() => setArmed(true)}
        >
          ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ
        </button>
      )}

      {state && (
        <label className="admin-bunker-sound">
          <input
            type="checkbox"
            checked={state.soundEnabled}
            disabled={busy}
            onChange={(event: ChangeEvent<HTMLInputElement>) => void run(() => deps.setSound(eventId, event.target.checked))}
          />
          <span>ТРЕВОЖНЫЙ ЗВУК НА ТВ</span>
        </label>
      )}

      {error && <p className="admin-bunker-error" role="alert">{error}</p>}
    </section>
  );
}
