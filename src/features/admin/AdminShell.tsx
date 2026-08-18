import { useEffect, useRef, useState } from 'react';
import type { OwnerCarriageCall } from '../carriages/carriageCalls.service';
import type { AdminDashboard, EventTestResetResult } from './admin.service';
import { AdminCarriageCalls } from './carriages/AdminCarriageCalls';
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

export type AdminShellDependencies = {
  load: () => Promise<AdminDashboard>;
  deleteGuest: (guestId: string) => Promise<void>;
  reassignGuest: (guestId: string, carriageId: string) => Promise<void>;
  lockComposition: (eventId: string) => Promise<{ registrationOpen: boolean }>;
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
};

type AdminShellProps = {
  dependencies: AdminShellDependencies;
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

export function AdminShell({ dependencies }: AdminShellProps) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const dashboardRef = useRef<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [locking, setLocking] = useState(false);
  const [notices, setNotices] = useState<RegistrationNotice[]>([]);

  const storeDashboard = (next: AdminDashboard) => {
    dashboardRef.current = next;
    setDashboard(next);
  };

  useEffect(() => {
    let cancelled = false;
    void dependencies.load()
      .then((next) => {
        if (!cancelled) storeDashboard(next);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить админку. Проверьте связь и доступ владельца.');
      });

    return () => {
      cancelled = true;
    };
  }, [dependencies]);

  useEffect(() => {
    if (!dashboard?.event.id || !dependencies.subscribeToRegistrations) return;
    let active = true;

    return dependencies.subscribeToRegistrations(() => {
      void dependencies.load()
        .then((fresh) => {
          if (!active) return;
          const previousIds = new Set((dashboardRef.current?.guests ?? []).map((guest) => guest.id));
          const newlyRegistered = fresh.guests.filter((guest) => !previousIds.has(guest.id));
          storeDashboard(fresh);

          if (newlyRegistered.length > 0) {
            const nextNotices = newlyRegistered.map<RegistrationNotice>((guest) => ({
              guestId: guest.id,
              fullName: `${guest.firstName} ${guest.lastName}`,
              carriageLabel: guest.carriage.label,
              carriageAccent: guest.carriage.accentHex,
              affiliationLabel: affiliationLabels[guest.affiliationType] ?? guest.affiliationType,
              createdAt: guest.registeredAt,
            }));
            setNotices((current) => enqueueNotices(current, nextNotices));
          }
        })
        .catch(() => {
          if (active) setError('Связь с регистрациями прервалась. Обновите админку или проверьте интернет.');
        });
    });
  }, [dashboard?.event.id, dependencies]);

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

  const handleTestReset = async (confirmation: string): Promise<EventTestResetResult> => {
    if (!dependencies.resetEventTestData) {
      throw new Error('Test reset is not configured');
    }
    const result = await dependencies.resetEventTestData(dashboard.event.id, confirmation);
    const fresh = await dependencies.load();
    setNotices([]);
    storeDashboard(fresh);
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

      <AdminRehearsalPanel />

      <section className="admin-operations" aria-label="Управление составом">
        {dashboard.event.compositionLocked ? (
          <strong>СОСТАВ ЗАФИКСИРОВАН</strong>
        ) : (
          <button
            type="button"
            className="registration-secondary"
            disabled={locking}
            onClick={() => void handleLockComposition()}
          >
            {locking ? 'ФИКСИРУЕМ…' : 'ЗАФИКСИРОВАТЬ СОСТАВ'}
          </button>
        )}
        <p>Фиксация не закрывает регистрацию: опоздавшие гости продолжат получать свободный подходящий вагон.</p>
      </section>

      {dependencies.couplePreanswers && (
        <AdminCouplePreanswersPanel
          eventId={dashboard.event.id}
          dependencies={dependencies.couplePreanswers}
        />
      )}

      {dependencies.premiere && (
        <AdminPremiereControl
          eventId={dashboard.event.id}
          registeredCount={dashboard.guests.length}
          expectedGuestCount={dashboard.event.expectedGuestCount}
          lastRegisteredAt={latestRegistrationAt(dashboard)}
          dependencies={dependencies.premiere}
        />
      )}

      {dependencies.quiz && (
        <AdminQuizPanel eventId={dashboard.event.id} dependencies={dependencies.quiz} />
      )}

      {dependencies.finalFive && (
        <AdminFinalFivePanel eventId={dashboard.event.id} dependencies={dependencies.finalFive} />
      )}

      {dependencies.mortalKombat && (
        <AdminMkControl eventId={dashboard.event.id} dependencies={dependencies.mortalKombat} />
      )}

      {dependencies.sendCarriageCall && dependencies.clearCarriageCall && (
        <AdminCarriageCalls
          carriages={dashboard.carriages.filter((carriage) => carriage.enabled)}
          onSend={dependencies.sendCarriageCall}
          onClear={dependencies.clearCarriageCall}
        />
      )}

      <AdminGuestsPage
        guests={dashboard.guests}
        carriages={dashboard.carriages.filter((carriage) => carriage.enabled)}
        onDelete={handleDelete}
        onReassign={handleReassign}
        onIssueRecovery={dependencies.issueGuestRecovery}
      />

      {dependencies.resetEventTestData && (
        <AdminTestResetPanel
          guestCount={dashboard.guests.length}
          onReset={handleTestReset}
        />
      )}
    </main>
  );
}
