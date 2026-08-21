import { useEffect, useMemo, useState } from 'react';
import {
  getPremierePresenceSummary,
  recordPremiereScreenPresence,
  type PremiereScreenPresenceRecord,
} from '../../premiere/premierePresence';
import type { PremiereScreenPresence } from '../../premiere/premierePresence.realtime';
import type { OwnerPremiereControl } from '../../premiere/premiere.service';
import type { OwnerCouplePreanswerStatus } from '../../quiz/ownerCouplePreanswers.service';

const rehearsalLinks = [
  { href: '/screen', label: 'ОТКРЫТЬ ТВ', hint: 'Главный экран' },
  { href: '/join', label: 'РЕГИСТРАЦИЯ ГОСТЯ', hint: 'Тестовый телефон' },
  { href: '/play', label: 'КВИЗ', hint: 'Экран гостя' },
  { href: '/mortal-kombat', label: 'ТУРНИР', hint: 'Участие гостя' },
  { href: '/mortal-kombat/screen', label: 'ТУРНИР НА ТВ', hint: 'Отдельный экран' },
] as const;

type RehearsalPremiereDependencies = {
  load: (eventId: string) => Promise<OwnerPremiereControl>;
  subscribeScreenPresence?: (callback: (presence: PremiereScreenPresence) => void) => () => void;
};

type RehearsalCoupleDependencies = {
  load: (eventId: string) => Promise<OwnerCouplePreanswerStatus>;
};

type AdminRehearsalPanelProps = {
  eventId?: string;
  currentModule?: string | null;
  currentScreenMode?: string | null;
  expectedScreenCount?: number;
  registrationOpen?: boolean;
  compositionLocked?: boolean;
  guestCount?: number;
  premiere?: RehearsalPremiereDependencies;
  couplePreanswers?: RehearsalCoupleDependencies;
};

function runtimeHas(runtime: string, names: string[]): boolean {
  const normalized = runtime.toLowerCase();
  return names.some((name) => normalized.includes(name));
}

export function AdminRehearsalPanel({
  eventId,
  currentModule,
  currentScreenMode,
  registrationOpen,
  compositionLocked,
  guestCount,
  premiere,
  couplePreanswers,
}: AdminRehearsalPanelProps = {}) {
  const [premiereState, setPremiereState] = useState<OwnerPremiereControl | null>(null);
  const [coupleStatus, setCoupleStatus] = useState<OwnerCouplePreanswerStatus | null>(null);
  const [premiereError, setPremiereError] = useState(false);
  const [coupleError, setCoupleError] = useState(false);
  const [presenceRecords, setPresenceRecords] = useState<PremiereScreenPresenceRecord[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());

  const showReadiness = Boolean(eventId && premiere && couplePreanswers);
  const showEventStartReadiness = typeof registrationOpen === 'boolean'
    && typeof compositionLocked === 'boolean'
    && typeof guestCount === 'number';
  const eventStartClean = showEventStartReadiness
    && registrationOpen === true
    && compositionLocked === false
    && guestCount === 0;

  useEffect(() => {
    if (!eventId || !premiere || !couplePreanswers) return undefined;
    let active = true;

    setPremiereState(null);
    setCoupleStatus(null);
    setPremiereError(false);
    setCoupleError(false);

    void premiere.load(eventId)
      .then((next) => {
        if (active) setPremiereState(next);
      })
      .catch(() => {
        if (active) setPremiereError(true);
      });

    void couplePreanswers.load(eventId)
      .then((next) => {
        if (active) setCoupleStatus(next);
      })
      .catch(() => {
        if (active) setCoupleError(true);
      });

    return () => {
      active = false;
    };
  }, [couplePreanswers, eventId, premiere]);

  useEffect(() => {
    if (!showReadiness || !premiere?.subscribeScreenPresence) return undefined;
    return premiere.subscribeScreenPresence((presence) => {
      const receivedAt = Date.now();
      setPresenceNowMs(receivedAt);
      setPresenceRecords((current) => recordPremiereScreenPresence(current, presence, receivedAt));
    });
  }, [premiere, showReadiness]);

  useEffect(() => {
    if (!showReadiness || !premiere?.subscribeScreenPresence) return undefined;
    const interval = window.setInterval(() => setPresenceNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [premiere, showReadiness]);

  const presence = useMemo(
    () => getPremierePresenceSummary(presenceRecords, presenceNowMs),
    [presenceNowMs, presenceRecords],
  );

  const runtime = `${currentModule ?? ''} ${currentScreenMode ?? ''}`;
  const bunkerActive = runtimeHas(runtime, ['bunker']);
  const mortalKombatActive = runtimeHas(runtime, ['mortal_kombat', 'mortal-kombat', 'mortal kombat', 'mk']);
  const screensOnline = presence.connectedCount > 0;
  const videoReady = presence.videoReadyCount > 0;
  const audioReady = presence.audioArmedCount > 0;
  const premiereReady = premiereState?.configured === true
    && (premiereState.status === 'idle' || premiereState.status === 'standby');
  const coupleReady = coupleStatus?.status === 'finalized';
  const loading = showReadiness && !premiereError && !coupleError && (!premiereState || !coupleStatus);

  const premiereLabel = premiereError
    ? 'ПРЕМЬЕРА · ПРОВЕРКА НЕДОСТУПНА'
    : !premiereState
      ? 'ПРЕМЬЕРА · ПРОВЕРЯЕМ'
      : !premiereState.configured
        ? 'ПРЕМЬЕРА · НЕ НАСТРОЕНА'
        : premiereReady
          ? 'ПРЕМЬЕРА · ГОТОВА'
          : 'ПРЕМЬЕРА · АКТИВНА';

  const coupleLabel = coupleError
    ? 'ОТВЕТЫ ПАРЫ · ПРОВЕРКА НЕДОСТУПНА'
    : !coupleStatus
      ? 'ОТВЕТЫ ПАРЫ · ПРОВЕРЯЕМ'
      : coupleReady
        ? 'ОТВЕТЫ ПАРЫ · ГОТОВЫ'
        : coupleStatus.status === 'not_issued'
          ? 'ОТВЕТЫ ПАРЫ · ССЫЛКА НЕ ВЫДАНА'
          : `ОТВЕТЫ ПАРЫ · ${coupleStatus.answeredCount} / ${coupleStatus.totalCount}`;

  return (
    <section className="admin-rehearsal" aria-labelledby="admin-rehearsal-title">
      <div className="admin-rehearsal__heading">
        <div>
          <p className="eyebrow">БЫСТРЫЙ ДОСТУП</p>
          <h2 id="admin-rehearsal-title">РЕПЕТИЦИЯ</h2>
        </div>
        <p>Открывайте тестовые экраны в новых вкладках — админка останется под рукой.</p>
      </div>

      {showReadiness && (
        <div className="admin-rehearsal__readiness" aria-label="Статусы репетиции">
          <div className="admin-rehearsal__verdict is-info" role="status">
            <span>ПРОВЕРКА ПЕРЕД ЗАПУСКОМ</span>
            <strong>{loading ? 'СОБИРАЕМ СТАТУСЫ…' : 'ИНДИКАЦИЯ · НЕ БЛОКИРУЕТ'}</strong>
          </div>

          <div className="admin-rehearsal__checks">
            <span className={screensOnline ? 'is-ready' : 'is-watch'}>ТВ · {presence.connectedCount}</span>
            <span className={videoReady ? 'is-ready' : 'is-watch'}>ВИДЕО · {presence.videoReadyCount} / {presence.connectedCount}</span>
            <span className={audioReady ? 'is-ready' : 'is-watch'}>ЗВУК · {presence.audioArmedCount} / {presence.connectedCount}</span>
            <span className={premiereReady ? 'is-ready' : 'is-watch'}>{premiereLabel}</span>
            <span className={coupleReady ? 'is-ready' : 'is-watch'}>{coupleLabel}</span>
            <span className={bunkerActive ? 'is-watch' : 'is-ready'}>БУНКЕР · {bunkerActive ? 'АКТИВЕН' : 'ГОТОВ'}</span>
            <span className={mortalKombatActive ? 'is-watch' : 'is-ready'}>ТУРНИР · {mortalKombatActive ? 'АКТИВЕН' : 'ГОТОВ'}</span>
          </div>

          {showEventStartReadiness && (
            <>
              <div className={`admin-rehearsal__verdict ${eventStartClean ? 'is-ready' : 'is-info'}`}>
                <span>СОСТОЯНИЕ ПЕРЕД ГОСТЯМИ</span>
                <strong>{eventStartClean ? 'СТАРТ СОБЫТИЯ · ЧИСТО' : 'СТАРТ СОБЫТИЯ · ПРОВЕРИТЬ'}</strong>
              </div>
              <div className="admin-rehearsal__checks" aria-label="Чистота стартового состояния">
                <span className={registrationOpen ? 'is-ready' : 'is-watch'}>
                  РЕГИСТРАЦИЯ · {registrationOpen ? 'ОТКРЫТА' : 'ЗАКРЫТА'}
                </span>
                <span className={guestCount === 0 ? 'is-ready' : 'is-watch'}>
                  ТЕСТОВЫЕ ГОСТИ · {guestCount}
                </span>
                <span className={!compositionLocked ? 'is-ready' : 'is-watch'}>
                  СОСТАВ · {compositionLocked ? 'ЗАФИКСИРОВАН' : 'СВОБОДЕН'}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <nav className="admin-rehearsal__links" aria-label="Ссылки для репетиции">
        {rehearsalLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
          >
            <span>{link.hint}</span>
            <strong>{link.label}</strong>
            <i aria-hidden="true">↗</i>
          </a>
        ))}
      </nav>
    </section>
  );
}

