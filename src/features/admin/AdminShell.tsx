import { useCallback, useEffect, useRef, useState } from 'react';
import type { OwnerCarriageCall } from '../carriages/carriageCalls.service';
import type {
  AdminDashboard,
  CarriageDistributionResult,
  EventTestResetResult,
} from './admin.service';
import { AdminCarriageCalls } from './carriages/AdminCarriageCalls';
import { AdminCarriageDistribution } from './carriages/AdminCarriageDistribution';
import { AdminGuestsPage } from './guests/AdminGuestsPage';
import { AdminMkControl, type AdminMkControlDependencies } from './mortalKombat/AdminMkControl';
import { AdminRegistrationToasts } from './notifications/AdminRegistrationToasts';
import { enqueueNotices, type RegistrationNotice } from './notifications/notificationQueue';
import {
  AdminPremiereControl,
  type AdminPremiereControlDependencies,
} from './premiere/AdminPremiereControl';
import { AdminRehearsalPanel } from './rehearsal/AdminRehearsalPanel';
import { AdminTestResetPanel } from './reset/AdminTestResetPanel';
import {
  AdminCouplePreanswersPanel,
  type AdminCouplePreanswersPanelDependencies,
} from './quiz/AdminCouplePreanswersPanel';
import { AdminFinalFivePanel, type AdminFinalFivePanelDependencies } from './quiz/AdminFinalFivePanel';
import { AdminQuizPanel, type AdminQuizPanelDependencies } from './quiz/AdminQuizPanel';
import { isOwnerSessionExpired } from './ownerSession';
import { AdminMobileNavigation } from './AdminMobileNavigation';

export type AdminShellDependencies = {
  load: () => Promise<AdminDashboard>;
  deleteGuest: (guestId: string) => Promise<void>;
  reassignGuest: (guestId: string, carriageId: string) => Promise<void>;
  lockComposition: (eventId: string) => Promise<{ registrationOpen: boolean }>;
  applyCarriageDistribution?: (
    eventId: string,
    carriageCount: number,
  ) => Promise<CarriageDistributionResult>;
  issueGuestRecovery?: (guestId: string) => Promise<{ code: string; expiresAt: string }>;
  resetEventTestData?: (eventId: string, confirmation: string) => Promise<EventTestResetResult>;
  subscribeToRegistrations?: (callback: (guestId: string) => void) => () => void;
  sendCarriageCall?: (
    carriageIds: string[],
    message: string,
    showOnScreen: boolean,
  ) => Promise<OwnerCarriageCall>;
  clearCarriageCall?: (callId: string, carriageIds: string[]) => Promise<void>;
  couplePreanswers?: AdminCouplePreanswersPanelDependencies;
  premiere?: AdminPremiereControlDependencies;
  quiz?: AdminQuizPanelDependencies;
  finalFive?: AdminFinalFivePanelDependencies;
  mortalKombat?: AdminMkControlDependencies;
  onSessionExpired?: () => void;
};

type AdminShellProps = {
  dependencies: AdminShellDependencies;
  refreshIntervalMs?: number;
};

const affiliationLabels: Record<string, string> = {
  liza: 'Со стороны Лизы',
  viktor: 'Со стороны Виктора',
  common: 'Общие друзья',
  family: 'Семья / родственники',
  colleagues: 'Коллеги',
  other: 'Другое',
};

function latestRegistrationAt(dashboard: AdminDashboard): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const guest of dashboard.guests) {
    const ms = Date.parse(guest.registeredAt);
    if (!Number.isFinite(ms) || ms <= latestMs) continue;
    latestMs = ms;
    latest = guest.registeredAt;
  }

  return latest;
}

function registrationNotices(
  previous: AdminDashboard | null,
  fresh: AdminDashboard,
): RegistrationNotice[] {
  if (!previous) return [];
  const previousIds = new Set(previous.guests.map((guest) => guest.id));
  return fresh.guests
    .filter((guest) => !previousIds.has(guest.id))
    .map((guest) => ({
      guestId: guest.id,
      fullName: `${guest.firstName} ${guest.lastName}`,
      carriageLabel: guest.carriage.label,
      carriageAccent: guest.carriage.accentHex,
      affiliationLabel: affiliationLabels[guest.affiliationType] ?? guest.affiliationType,
      createdAt: guest.registeredAt,
    }));
}

export function AdminShell({ dependencies, refreshIntervalMs = 4_000 }: AdminShellProps) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const dashboardRef = useRef<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [syncWarning, setSyncWarning] = useState(false);
  const [locking, setLocking] = useState(false);
  const [notices, setNotices] = useState<RegistrationNotice[]>([]);

  const storeDashboard = useCallback((next: AdminDashboard) => {
    dashboardRef.current = next;
    setDashboard(next);
  }, []);

  const storeFreshDashboard = useCallback((fresh: AdminDashboard, announceNewGuests: boolean) => {
    const nextNotices = announceNewGuests ? registrationNotices(dashboardRef.current, fresh) : [];
    storeDashboard(fresh);
    if (nextNotices.length > 0) {
      setNotices((current) => enqueueNotices(current, nextNotices));
    }
    setSyncWarning(false);
  }, [storeDashboard]);

  const refreshBackground = useCallback(async () => {
    try {
      const fresh = await dependencies.load();
      storeFreshDashboard(fresh, true);
    } catch (refreshError) {
      if (isOwnerSessionExpired(refreshError) && dependencies.onSessionExpired) {
        dependencies.onSessionExpired();
      } else {
        setSyncWarning(true);
      }
    }
  }, [dependencies, storeFreshDashboard]);

  useEffect(() => {
    let cancelled = false;
    void dependencies.load()
      .then((next) => {
        if (!cancelled) {
          storeFreshDashboard(next, false);
          setError('');
        }
      })
      .catch((loadError) => {
        if (cancelled) return;
        if (isOwnerSessionExpired(loadError) && dependencies.onSessionExpired) {
          dependencies.onSessionExpired();
        } else {
          setError('Не удалось загрузить админку. Проверьте связь и доступ владельца.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dependencies, storeFreshDashboard]);

  useEffect(() => {
    if (!dashboard?.event.id || !dependencies.subscribeToRegistrations) return undefined;
    return dependencies.subscribeToRegistrations(() => {
      void refreshBackground();
    });
  }, [dashboard?.event.id, dependencies, refreshBackground]);

  useEffect(() => {
    if (!dashboard?.event.id || refreshIntervalMs <= 0) return undefined;
    const interval = window.setInterval(() => {
      void refreshBackground();
    }, refreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [dashboard?.event.id, refreshBackground, refreshIntervalMs]);

  if (error) {
    return (
      <main className="page-shell">
        <section className="placeholder-card" role="alert">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>АДМИНКА НЕДОСТУПНА</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!dashboard) {
    return (
      <main className="page-shell">
        <section className="placeholder-card" aria-live="polite">
          <p className="eyebrow">OWNER ONLY</p>
          <h1>ЗАГРУЖАЕМ СОСТАВ…</h1>
        </section>
      </main>
    );
  }

  const handleDelete = async (guestId: string) => {
    await dependencies.deleteGuest(guestId);
    setDashboard((current) => {
      if (!current) return current;
      const next = {
        ...current,
        guests: current.guests.filter((guest) => guest.id !== guestId),
      };
      dashboardRef.current = next;
      return next;
    });
  };

  const handleReassign = async (guestId: string, carriageId: string) => {
    await dependencies.reassignGuest(guestId, carriageId);
    setDashboard((current) => {
      if (!current) return current;
      const carriage = current.carriages.find((item) => item.id === carriageId);
      if (!carriage) return current;
      const next = {
        ...current,
        guests: current.guests.map((guest) => guest.id === guestId ? {
          ...guest,
          carriage: {
            id: carriage.id,
            number: carriage.number,
            label: carriage.label,
            accentHex: carriage.accentHex,
            visualMark: carriage.visualMark,
          },
        } : guest),
      };
      dashboardRef.current = next;
      return next;
    });
  };

  const handleLockComposition = async () => {
    setLocking(true);
    try {
      const result = await dependencies.lockComposition(dashboard.event.id);
      setDashboard((current) => {
        if (!current) return current;
        const next = {
          ...current,
          event: {
            ...current.event,
            compositionLocked: true,
            registrationOpen: result.registrationOpen,
          },
        };
        dashboardRef.current = next;
        return next;
      });
    } finally {
      setLocking(false);
    }
  };

  const handleApplyCarriageDistribution = async (carriageCount: number) => {
    if (!dependencies.applyCarriageDistribution) {
      await handleLockComposition();
      return;
    }

    await dependencies.applyCarriageDistribution(dashboard.event.id, carriageCount);
    try {
      const fresh = await dependencies.load();
      storeFreshDashboard(fresh, false);
    } catch {
      setDashboard((current) => {
        if (!current) return current;
        const next = {
          ...current,
          event: { ...current.event, compositionLocked: true, registrationOpen: true },
        };
        dashboardRef.current = next;
        return next;
      });
      setSyncWarning(true);
    }
  };

  const handleTestReset = async (confirmation: string): Promise<EventTestResetResult> => {
    if (!dependencies.resetEventTestData) {
      throw new Error('Test reset is not configured');
    }
    const result = await dependencies.resetEventTestData(dashboard.event.id, confirmation);
    setNotices([]);
    try {
      const fresh = await dependencies.load();
      storeFreshDashboard(fresh, false);
    } catch (refreshError) {
      if (isOwnerSessionExpired(refreshError) && dependencies.onSessionExpired) {
        dependencies.onSessionExpired();
      } else {
        setSyncWarning(true);
      }
    }
    return result;
  };

  return (
    <main className="admin-shell">
      <AdminRegistrationToasts
        notices={notices}
        onDismiss={(guestId) => setNotices((current) => current.filter((notice) => notice.guestId !== guestId))}
      />

      <header className="admin-hero">
        <div>
          <p className="eyebrow">30.08.2026 · OWNER CONTROL</p>
          <h1>{dashboard.event.name}</h1>
        </div>
        <div className="admin-status-pills" aria-label="Статус события">
          <span>{dashboard.event.registrationOpen ? 'РЕГИСТРАЦИЯ ОТКРЫТА' : 'РЕГИСТРАЦИЯ ЗАКРЫТА'}</span>
          <span>{dashboard.guests.length} / ~{dashboard.event.expectedGuestCount}</span>
        </div>
      </header>

      <AdminMobileNavigation />

      {syncWarning && (
        <div className="admin-sync-warning" role="status">
          СВЯЗЬ С АДМИНКОЙ · ПЕРЕПОДКЛЮЧЕНИЕ
        </div>
      )}

      <div id="admin-now" className="admin-section-anchor">
        <AdminRehearsalPanel
          eventId={dashboard.event.id}
          currentModule={dashboard.state?.currentModule ?? 'idle'}
          currentScreenMode={dashboard.state?.screenMode ?? 'idle'}
          expectedScreenCount={2}
          registrationOpen={dashboard.event.registrationOpen}
          compositionLocked={dashboard.event.compositionLocked}
          guestCount={dashboard.guests.length}
          premiere={dependencies.premiere}
          couplePreanswers={dependencies.couplePreanswers}
        />
      </div>

      <section id="admin-composition" className="admin-operations admin-section-anchor" aria-label="Управление составом">
        <AdminCarriageDistribution
          guestCount={dashboard.guests.length}
          compositionLocked={dashboard.event.compositionLocked}
          activeCarriageCount={(() => {
            const count = dashboard.carriages.filter((carriage) => carriage.enabled).length;
            return count >= 2 && count <= 5 ? count as 2 | 3 | 4 | 5 : undefined;
          })()}
          onAccept={handleApplyCarriageDistribution}
        />
        <p>Фиксация не закрывает регистрацию: опоздавшие гости продолжат получать свободный подходящий вагон.</p>
      </section>

      {dependencies.couplePreanswers && (
        <AdminCouplePreanswersPanel
          eventId={dashboard.event.id}
          dependencies={dependencies.couplePreanswers}
        />
      )}

      {dependencies.premiere && (
        <div id="admin-premiere" className="admin-section-anchor">
          <AdminPremiereControl
            eventId={dashboard.event.id}
            registeredCount={dashboard.guests.length}
            expectedGuestCount={dashboard.event.expectedGuestCount}
            lastRegisteredAt={latestRegistrationAt(dashboard)}
            dependencies={dependencies.premiere}
          />
        </div>
      )}

      {dependencies.quiz && (
        <div id="admin-quiz" className="admin-section-anchor">
          <AdminQuizPanel eventId={dashboard.event.id} dependencies={dependencies.quiz} />
        </div>
      )}

      {dependencies.finalFive && (
        <AdminFinalFivePanel eventId={dashboard.event.id} dependencies={dependencies.finalFive} />
      )}

      {dependencies.mortalKombat && (
        <div id="admin-tournament" className="admin-section-anchor">
          <AdminMkControl eventId={dashboard.event.id} dependencies={dependencies.mortalKombat} />
        </div>
      )}

      {dependencies.sendCarriageCall && dependencies.clearCarriageCall && (
        <AdminCarriageCalls
          carriages={dashboard.carriages.filter((carriage) => carriage.enabled)}
          onSend={dependencies.sendCarriageCall}
          onClear={dependencies.clearCarriageCall}
        />
      )}

      <div id="admin-guests" className="admin-section-anchor">
        <AdminGuestsPage
          guests={dashboard.guests}
          carriages={dashboard.carriages.filter((carriage) => carriage.enabled)}
          onDelete={handleDelete}
          onReassign={handleReassign}
          onIssueRecovery={dependencies.issueGuestRecovery}
        />
      </div>

      {dependencies.resetEventTestData && (
        <div id="admin-reset" className="admin-section-anchor">
          <AdminTestResetPanel
            guestCount={dashboard.guests.length}
            onReset={handleTestReset}
          />
        </div>
      )}
    </main>
  );
}
