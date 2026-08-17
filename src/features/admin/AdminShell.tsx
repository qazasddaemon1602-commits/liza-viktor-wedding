import { useEffect, useRef, useState } from 'react';
import type { AdminDashboard } from './admin.service';
import { AdminGuestsPage } from './guests/AdminGuestsPage';
import { AdminRegistrationToasts } from './notifications/AdminRegistrationToasts';
import { enqueueNotices, type RegistrationNotice } from './notifications/notificationQueue';

export type AdminShellDependencies = {
  load: () => Promise<AdminDashboard>;
  deleteGuest: (guestId: string) => Promise<void>;
  reassignGuest: (guestId: string, carriageId: string) => Promise<void>;
  lockComposition: (eventId: string) => Promise<{ registrationOpen: boolean }>;
  issueGuestRecovery?: (guestId: string) => Promise<{ code: string; expiresAt: string }>;
  subscribeToRegistrations?: (callback: (guestId: string) => void) => () => void;
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

      <AdminGuestsPage
        guests={dashboard.guests}
        carriages={dashboard.carriages.filter((carriage) => carriage.enabled)}
        onDelete={handleDelete}
        onReassign={handleReassign}
        onIssueRecovery={dependencies.issueGuestRecovery}
      />
    </main>
  );
}
