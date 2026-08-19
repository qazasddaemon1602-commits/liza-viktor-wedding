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
  { href: '/mortal-kombat', label: 'MK', hint: 'Участие гостя' },
  { href: '/mortal-kombat/screen', label: 'MK НА ТВ', hint: 'Отдельный экран' },
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
  expectedScreenCount = 2,
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
  const screensReady = presence.connectedCount >= expectedScreenCount;
  const videoReady = presence.videoReadyCount >= expectedScreenCount;
  const audioReady = presence.audioArmedCount >= expectedScreenCount;
  const premiereReady = premiereState?.configured === true
    && (premiereState.status === 'idle' || premiereState.status === 'standby');
  const coupleReady = coupleStatus?.status === 'finalized';
  const loading = showReadiness && !premiereError && !coupleError && (!premiereState || !coupleStatus);
  const allReady = showReadiness
    && !loading
    && !premiereError
    && !coupleError
    && screensReady
    && videoReady
    && audioReady
    && premiereReady
    && coupleReady
    && !bunkerActive
    && !mortalKombatActive;

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
        <div className="admin-rehearsal__readiness" aria-label="Готовность к репетиции">
          <div className={`admin-rehearsal__verdict ${allReady ? 'is-ready' : 'has-blockers'}`} role="status">
            <span>ПРОВЕРКА ПЕРЕД ЗАПУСКОМ</span>
            <strong>{loading ? 'ПРОВЕРЯЕМ ГОТОВНОСТЬ…' : allReady ? 'ГОТОВО К РЕПЕТИЦИИ' : 'ЕСТЬ БЛОКЕРЫ'}</strong>
          </div>

          <div className="admin-rehearsal__checks">
            <span className={screensReady ? 'is-ready' : 'has-blocker'}>ТВ · {presence.connectedCount} / {expectedScreenCount}</span>
            <span className={videoReady ? 'is-ready' : 'has-blocker'}>ВИДЕО · {videoReady ? 'ГОТОВО' : 'НЕ ГОТОВО'}</span>
            <span className={audioReady ? 'is-ready' : 'has-blocker'}>ЗВУК · {audioReady ? 'ГОТОВ' : 'НЕ ГОТОВ'}</span>
            <span className={premiereReady ? 'is-ready' : 'has-blocker'}>{premiereLabel}</span>
            <span className={coupleReady ? 'is-ready' : 'has-blocker'}>{coupleLabel}</span>
            <span className={bunkerActive ? 'has-blocker' : 'is-ready'}>БУНКЕР · {bunkerActive ? 'АКТИВЕН' : 'ГОТОВ'}</span>
            <span className={mortalKombatActive ? 'has-blocker' : 'is-ready'}>MK · {mortalKombatActive ? 'АКТИВЕН' : 'ГОТОВ'}</span>
          </div>
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
