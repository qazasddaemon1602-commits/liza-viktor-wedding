import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  getOwnerMessageCapsule,
  publishOwnerMessageCapsule,
  setOwnerMessageCapsuleOpen,
  type OwnerMessageCapsuleControl,
  type PublishCapsuleResult,
} from './messageCapsule.service';
import {
  RADIO_PRESETS,
  sendTrainRadioTransmission,
  type RadioPresetId,
  type SendRadioTransmissionResult,
} from './trainRadio.service';
import type { WeddingLiveRpcClient } from './weddingLive.service';

export type AdminWeddingLiveDependencies = {
  load: () => Promise<OwnerMessageCapsuleControl>;
  setOpen: (open: boolean) => Promise<{ status: 'ok'; open: boolean }>;
  publish: (limit: number) => Promise<PublishCapsuleResult>;
  sendRadio?: (preset: RadioPresetId) => Promise<SendRadioTransmissionResult>;
};

type Props = {
  eventSlug?: string;
  dependencies?: AdminWeddingLiveDependencies;
  children: ReactNode;
};

function browserDependencies(eventSlug: string): AdminWeddingLiveDependencies {
  const client = getSupabaseClient() as unknown as WeddingLiveRpcClient;
  return {
    load: () => getOwnerMessageCapsule(client, eventSlug),
    setOpen: (open) => setOwnerMessageCapsuleOpen(client, eventSlug, open),
    publish: (limit) => publishOwnerMessageCapsule(client, eventSlug, limit),
    sendRadio: (preset) => sendTrainRadioTransmission(client, eventSlug, preset),
  };
}

export function AdminWeddingLiveDock({
  eventSlug = 'liza-viktor',
  dependencies,
  children,
}: Props) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [control, setControl] = useState<OwnerMessageCapsuleControl | null>(null);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const [radioFeedback, setRadioFeedback] = useState('');
  const [error, setError] = useState('');

  const reload = async () => {
    const next = await deps.load();
    setControl(next);
    return next;
  };

  useEffect(() => {
    if (!drawerOpen) return;
    let active = true;
    setError('');
    void deps.load()
      .then((next) => {
        if (active) setControl(next);
      })
      .catch(() => {
        if (active) setError('LIVE+ недоступен. Проверьте вход администратора и связь.');
      });
    const interval = window.setInterval(() => {
      void deps.load().then((next) => {
        if (active) setControl(next);
      }).catch(() => undefined);
    }, 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [deps, drawerOpen]);

  const toggleOpen = async () => {
    if (control?.status !== 'ok' || busy) return;
    const nextOpen = !control.open;
    setBusy('toggle');
    setFeedback('');
    setError('');
    try {
      const result = await deps.setOpen(nextOpen);
      setControl({ ...control, open: result.open });
      setFeedback(result.open ? 'ПРИЁМ СООБЩЕНИЙ ОТКРЫТ' : 'ПРИЁМ СООБЩЕНИЙ ЗАКРЫТ');
    } catch {
      setError('Не удалось изменить режим капсулы.');
    } finally {
      setBusy('');
    }
  };

  const publish = async () => {
    if (control?.status !== 'ok' || control.count === 0 || busy) return;
    setBusy('publish');
    setFeedback('');
    setError('');
    try {
      const result = await deps.publish(7);
      if (result.status === 'empty') setFeedback('ПОКА НЕТ СООБЩЕНИЙ');
      else setFeedback(`НА ТВ · ${result.publishedCount} СООБЩЕНИЙ`);
      await reload().catch(() => undefined);
    } catch {
      setError('Не удалось отправить капсулу на телевизоры.');
    } finally {
      setBusy('');
    }
  };

  const sendRadio = async (preset: RadioPresetId, label: string) => {
    if (!deps.sendRadio || busy) return;
    setBusy(`radio:${preset}`);
    setRadioFeedback('');
    setError('');
    try {
      await deps.sendRadio(preset);
      setRadioFeedback(`ЭФИР ОТПРАВЛЕН · ${label}`);
    } catch {
      setError('Не удалось отправить радиоэфир на телевизоры.');
    } finally {
      setBusy('');
    }
  };

  const ready = control?.status === 'ok' ? control : null;

  return (
    <>
      {children}
      <button
        type="button"
        className="admin-wedding-live-launcher"
        aria-label="Открыть LIVE+ пульт"
        onClick={() => setDrawerOpen(true)}
      >
        LIVE+
      </button>

      {drawerOpen && (
        <div className="admin-wedding-live-layer">
          <button
            type="button"
            className="admin-wedding-live-layer__backdrop"
            aria-label="Закрыть LIVE+ пульт"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="admin-wedding-live-drawer" aria-label="LIVE+ пульт">
            <header>
              <div>
                <p>LIVE+ · СВАДЕБНЫЙ ЭФИР</p>
                <h2>УПРАВЛЕНИЕ ЭФИРОМ</h2>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setDrawerOpen(false)}>×</button>
            </header>

            {deps.sendRadio && (
              <section className="admin-wedding-radio" aria-label="Радио состава">
                <div className="admin-wedding-live-section-heading">
                  <div>
                    <span>LIVE OVERLAY</span>
                    <strong>РАДИО СОСТАВА</strong>
                  </div>
                  <small>12 СЕК · БЕЗ ПЕРЕКЛЮЧЕНИЯ ЭТАПА</small>
                </div>
                <div className="admin-wedding-radio__presets">
                  {RADIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-label={`Эфир: ${preset.label}`}
                      disabled={Boolean(busy)}
                      onClick={() => void sendRadio(preset.id, preset.label)}
                    >
                      {busy === `radio:${preset.id}` ? 'В ЭФИР…' : preset.label}
                    </button>
                  ))}
                </div>
                {radioFeedback && <p className="admin-wedding-live-feedback" role="status">{radioFeedback}</p>}
              </section>
            )}

            <section className="admin-wedding-capsule-control" aria-label="Капсула вечера">
              <div className="admin-wedding-live-section-heading">
                <div>
                  <span>ГОСТИ → МОЛОДОЖЁНЫ</span>
                  <strong>КАПСУЛА ВЕЧЕРА</strong>
                </div>
              </div>

              {!control && !error && <p className="admin-wedding-live-status">ЗАГРУЖАЕМ…</p>}
              {error && <p className="admin-wedding-live-error" role="alert">{error}</p>}
              {control?.status === 'not_found' && <p className="admin-wedding-live-error">Событие не найдено.</p>}

              {ready && (
                <>
                  <section className="admin-wedding-live-summary">
                    <div>
                      <span>СООБЩЕНИЯ</span>
                      <strong>{ready.count} СООБЩЕНИЯ</strong>
                    </div>
                    <div>
                      <span>ПРИЁМ</span>
                      <strong>{ready.open ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</strong>
                    </div>
                  </section>

                  <div className="admin-wedding-live-actions">
                    <button type="button" disabled={Boolean(busy)} onClick={() => void toggleOpen()}>
                      {busy === 'toggle' ? 'МЕНЯЕМ…' : ready.open ? 'ЗАКРЫТЬ ПРИЁМ' : 'ОТКРЫТЬ ПРИЁМ'}
                    </button>
                    <button type="button" disabled={Boolean(busy) || ready.count === 0} onClick={() => void publish()}>
                      {busy === 'publish' ? 'ОТПРАВЛЯЕМ…' : 'ПОКАЗАТЬ КАПСУЛУ НА ТВ'}
                    </button>
                  </div>

                  {feedback && <p className="admin-wedding-live-feedback" role="status">{feedback}</p>}

                  <section className="admin-wedding-live-messages" aria-label="Сообщения гостей">
                    <div className="admin-wedding-live-messages__heading">
                      <strong>СООБЩЕНИЯ ГОСТЕЙ</strong>
                      <span>{ready.count}</span>
                    </div>
                    {ready.messages.length === 0 ? (
                      <p className="admin-wedding-live-empty">Пока никто ничего не оставил.</p>
                    ) : ready.messages.map((message) => (
                      <article key={message.guestId}>
                        <div><strong>{message.displayName}</strong><span>{message.carriage}</span></div>
                        <p>{message.message}</p>
                      </article>
                    ))}
                  </section>
                </>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
