import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  getPremierePresenceSummary,
  recordPremiereScreenPresence,
  type PremiereScreenPresenceRecord,
} from '../../premiere/premierePresence';
import type { PremiereScreenPresence } from '../../premiere/premierePresence.realtime';
import type { OwnerPremiereControl } from '../../premiere/premiere.service';
import { getPremiereReadiness, PremiereReadiness } from './PremiereReadiness';

export type AdminPremiereControlDependencies = {
  load: (eventId: string) => Promise<OwnerPremiereControl>;
  setMedia: (eventId: string, mediaUrl: string, durationSeconds: number) => Promise<unknown>;
  standby: (eventId: string) => Promise<unknown>;
  start: (eventId: string, countdownSeconds: number) => Promise<unknown>;
  cancel: (eventId: string) => Promise<unknown>;
  pause: (eventId: string) => Promise<unknown>;
  resume: (eventId: string) => Promise<unknown>;
  seek: (eventId: string, positionSeconds: number) => Promise<unknown>;
  restart: (eventId: string) => Promise<unknown>;
  black: (eventId: string) => Promise<unknown>;
  returnMain: (eventId: string) => Promise<unknown>;
  setCountdownSound: (eventId: string, enabled: boolean) => Promise<unknown>;
  broadcastRefresh: () => Promise<unknown>;
  subscribeScreenPresence?: (
    callback: (presence: PremiereScreenPresence) => void,
  ) => () => void;
};

type AdminPremiereControlProps = {
  eventId: string;
  registeredCount: number;
  expectedGuestCount: number;
  lastRegisteredAt: string | null;
  projectorConnected?: boolean;
  audioArmed?: boolean;
  nowMs?: number;
  dependencies: AdminPremiereControlDependencies;
};

function quietMinutes(lastRegisteredAt: string | null, nowMs: number): number {
  if (!lastRegisteredAt) return 0;
  const lastMs = Date.parse(lastRegisteredAt);
  if (!Number.isFinite(lastMs)) return 0;
  return Math.max(0, Math.floor((nowMs - lastMs) / 60_000));
}

function formatPosition(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

function statusLabel(state: OwnerPremiereControl): string {
  if (!state.configured) return 'ВИДЕО НЕ НАСТРОЕНО';
  switch (state.status) {
    case 'idle': return 'ВИДЕО ГОТОВО';
    case 'standby': return 'ЭКРАНЫ В РЕЖИМЕ ОЖИДАНИЯ';
    case 'countdown': return 'ИДЁТ ОТСЧЁТ';
    case 'playing': return 'ПРЕМЬЕРА ИДЁТ';
    case 'paused': return 'ПРЕМЬЕРА НА ПАУЗЕ';
    case 'black': return 'ЧЁРНЫЙ ЭКРАН';
  }
}

export function AdminPremiereControl({
  eventId,
  registeredCount,
  expectedGuestCount,
  lastRegisteredAt,
  projectorConnected,
  audioArmed,
  nowMs = Date.now(),
  dependencies,
}: AdminPremiereControlProps) {
  const [state, setState] = useState<OwnerPremiereControl | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [duration, setDuration] = useState('623');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [presenceRecords, setPresenceRecords] = useState<PremiereScreenPresenceRecord[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());

  const reload = async () => {
    const next = await dependencies.load(eventId);
    setState(next);
    if (next.configured) {
      setMediaUrl(next.mediaUrl);
      setDuration(String(next.durationSeconds));
    }
    return next;
  };

  useEffect(() => {
    let active = true;
    void dependencies.load(eventId)
      .then((next) => {
        if (!active) return;
        setState(next);
        if (next.configured) {
          setMediaUrl(next.mediaUrl);
          setDuration(String(next.durationSeconds));
        }
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить состояние премьеры.');
      });
    return () => {
      active = false;
    };
  }, [dependencies, eventId]);

  useEffect(() => {
    if (!dependencies.subscribeScreenPresence) return;
    return dependencies.subscribeScreenPresence((presence) => {
      const receivedAt = Date.now();
      setPresenceNowMs(receivedAt);
      setPresenceRecords((current) => recordPremiereScreenPresence(
        current,
        presence,
        receivedAt,
      ));
    });
  }, [dependencies]);

  useEffect(() => {
    if (!dependencies.subscribeScreenPresence) return;
    const interval = window.setInterval(() => {
      setPresenceNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [dependencies]);

  const run = async (name: string, action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(name);
    setError('');
    try {
      await action();
      await dependencies.broadcastRefresh();
      await reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Команда не выполнена';
      setError(message);
    } finally {
      setBusy('');
    }
  };

  const presenceSummary = useMemo(
    () => getPremierePresenceSummary(presenceRecords, presenceNowMs),
    [presenceNowMs, presenceRecords],
  );
  const hasLivePresence = Boolean(dependencies.subscribeScreenPresence);

  const readinessInputs = useMemo(() => ({
    expected: expectedGuestCount,
    registered: registeredCount,
    quietMinutes: quietMinutes(lastRegisteredAt, nowMs),
    projector: hasLivePresence ? presenceSummary.projectorConnected : projectorConnected,
    video: hasLivePresence ? presenceSummary.videoReady : state?.configured === true,
    audio: hasLivePresence ? presenceSummary.audioArmed : audioArmed,
  }), [
    audioArmed,
    expectedGuestCount,
    hasLivePresence,
    lastRegisteredAt,
    nowMs,
    presenceSummary,
    projectorConnected,
    registeredCount,
    state?.configured,
  ]);
  const readiness = useMemo(() => getPremiereReadiness(readinessInputs), [readinessInputs]);

  const saveMedia = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seconds = Number(duration);
    if (!mediaUrl.trim() || !Number.isFinite(seconds) || seconds <= 0) return;
    await run('media', () => dependencies.setMedia(eventId, mediaUrl.trim(), seconds));
  };

  if (!state) {
    return (
      <section className="admin-premiere-control" aria-live="polite">
        <p className="eyebrow">ПРЕМЬЕРА ТРЕКА</p>
        <h2>ЗАГРУЖАЕМ ПУЛЬТ…</h2>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  const currentPosition = state.configured ? state.positionSeconds : 0;
  const durationSeconds = state.configured ? state.durationSeconds : Number(duration) || 623;
  const canTransport = state.configured && (state.status === 'playing' || state.status === 'paused');

  return (
    <section className="admin-premiere-control" aria-label="Управление премьерой">
      <div className="admin-premiere-heading">
        <div>
          <p className="eyebrow">ПРЕМЬЕРА ТРЕКА</p>
          <h2>КОЛЬЦО · РЕЖИССЁРСКИЙ ПУЛЬТ</h2>
        </div>
        <strong className={`admin-premiere-status admin-premiere-status--${state.status}`}>
          {statusLabel(state)}
        </strong>
      </div>

      {hasLivePresence && (
        <div className="admin-premiere-live-screens" aria-label="Экраны премьеры">
          <strong>ЭКРАНЫ НА СВЯЗИ · {presenceSummary.connectedCount}</strong>
          <span>
            ВИДЕО {presenceSummary.videoReady ? 'ГОТОВО' : 'НЕ ГОТОВО'} · {presenceSummary.videoReadyCount}/{presenceSummary.connectedCount}
          </span>
          <span>
            ЗВУК {presenceSummary.audioArmed ? 'ГОТОВ' : 'НЕ ГОТОВ'} · {presenceSummary.audioArmedCount}/{presenceSummary.connectedCount}
          </span>
        </div>
      )}

      <PremiereReadiness inputs={readinessInputs} />

      <form className="admin-premiere-media" onSubmit={(event) => void saveMedia(event)}>
        <label>
          <span>Ссылка на видео</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://…/КОЛЬЦО.mp4"
            value={mediaUrl}
            onChange={(event) => setMediaUrl(event.target.value)}
          />
        </label>
        <label>
          <span>Длительность, сек</span>
          <input
            type="number"
            min="1"
            step="0.001"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="registration-secondary"
          disabled={busy !== '' || !mediaUrl.trim() || Number(duration) <= 0}
        >
          {busy === 'media' ? 'СОХРАНЯЕМ…' : 'СОХРАНИТЬ ВИДЕО'}
        </button>
      </form>

      {state.configured && (
        <div className="admin-premiere-progress" aria-label="Позиция трека">
          <span>{formatPosition(currentPosition)}</span>
          <div>
            <i style={{ width: `${Math.min(100, Math.max(0, currentPosition / durationSeconds * 100))}%` }} />
          </div>
          <span>{formatPosition(durationSeconds)}</span>
        </div>
      )}

      <div className="admin-premiere-primary-controls">
        {state.configured && state.status === 'idle' && (
          <button
            type="button"
            className="registration-submit"
            disabled={busy !== ''}
            onClick={() => void run('standby', () => dependencies.standby(eventId))}
          >
            {busy === 'standby' ? 'ГОТОВИМ ЭКРАНЫ…' : 'ПОДГОТОВИТЬ ПРЕМЬЕРУ'}
          </button>
        )}

        {state.configured && state.status === 'standby' && (
          <>
            <button
              type="button"
              className="registration-submit"
              disabled={busy !== '' || !readiness.technicalReady}
              onClick={() => void run('start', () => dependencies.start(eventId, 10))}
            >
              {busy === 'start' ? 'ЗАПУСКАЕМ…' : 'НАЧАТЬ ПРЕМЬЕРУ'}
            </button>
            {!readiness.technicalReady && (
              <p className="admin-premiere-start-lock" role="status">
                СТАРТ ЗАБЛОКИРОВАН · ДОЖДИТЕСЬ ЭКРАНА, ВИДЕО И ЗВУКА
              </p>
            )}
          </>
        )}

        {state.configured && state.status === 'countdown' && (
          <button
            type="button"
            className="registration-secondary"
            disabled={busy !== ''}
            onClick={() => void run('cancel', () => dependencies.cancel(eventId))}
          >
            ОТМЕНИТЬ ОТСЧЁТ
          </button>
        )}

        {state.configured && state.status === 'playing' && (
          <button
            type="button"
            className="registration-submit"
            disabled={busy !== ''}
            onClick={() => void run('pause', () => dependencies.pause(eventId))}
          >
            ПАУЗА
          </button>
        )}

        {state.configured && state.status === 'paused' && (
          <button
            type="button"
            className="registration-submit"
            disabled={busy !== ''}
            onClick={() => void run('resume', () => dependencies.resume(eventId))}
          >
            ПРОДОЛЖИТЬ
          </button>
        )}
      </div>

      {canTransport && (
        <div className="admin-premiere-transport" aria-label="Управление воспроизведением">
          <button
            type="button"
            className="registration-secondary"
            disabled={busy !== ''}
            onClick={() => void run('seek-back', () => dependencies.seek(eventId, Math.max(0, currentPosition - 5)))}
          >
            −5 СЕК
          </button>
          <button
            type="button"
            className="registration-secondary"
            disabled={busy !== ''}
            onClick={() => void run('seek-forward', () => dependencies.seek(eventId, Math.min(durationSeconds, currentPosition + 5)))}
          >
            +5 СЕК
          </button>
          <button
            type="button"
            className="registration-secondary"
            disabled={busy !== ''}
            onClick={() => void run('restart', () => dependencies.restart(eventId))}
          >
            С НАЧАЛА
          </button>
        </div>
      )}

      {state.configured && state.status !== 'idle' && (
        <div className="admin-premiere-emergency" aria-label="Аварийные команды премьеры">
          <button
            type="button"
            className="registration-secondary"
            disabled={busy !== ''}
            onClick={() => void run('black', () => dependencies.black(eventId))}
          >
            ЧЁРНЫЙ ЭКРАН
          </button>
          <button
            type="button"
            className="registration-secondary"
            disabled={busy !== ''}
            onClick={() => void run('main', () => dependencies.returnMain(eventId))}
          >
            ГЛАВНЫЙ ЭКРАН
          </button>
        </div>
      )}

      <label className="admin-premiere-sound">
        <input
          type="checkbox"
          checked={state.countdownSoundEnabled}
          disabled={busy !== ''}
          onChange={(event) => void run('sound', () => dependencies.setCountdownSound(eventId, event.target.checked))}
        />
        <span>ЗВУК ОТСЧЁТА</span>
      </label>

      {error && <p className="admin-premiere-error" role="alert">{error}</p>}
    </section>
  );
}
