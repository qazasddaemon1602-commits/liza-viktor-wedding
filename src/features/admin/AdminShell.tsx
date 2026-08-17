import { useEffect, useState } from 'react';
import type { AdminDashboard } from './admin.service';
import { AdminGuestsPage } from './guests/AdminGuestsPage';

export type AdminShellDependencies = {
  load: () => Promise<AdminDashboard>;
  deleteGuest: (guestId: string) => Promise<void>;
  reassignGuest: (guestId: string, carriageId: string) => Promise<void>;
  lockComposition: (eventId: string) => Promise<{ registrationOpen: boolean }>;
};

type AdminShellProps = {
  dependencies: AdminShellDependencies;
};

export function AdminShell({ dependencies }: AdminShellProps) {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState('');
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void dependencies.load()
      .then((next) => {
        if (!cancelled) setDashboard(next);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить админку. Проверьте связь и доступ владельца.');
      });

    return () => {
      cancelled = true;
    };
  }, [dependencies]);

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
    setDashboard((current) => current ? {
      ...current,
      guests: current.guests.filter((guest) => guest.id !== guestId),
    } : current);
  };

  const handleReassign = async (guestId: string, carriageId: string) => {
    await dependencies.reassignGuest(guestId, carriageId);
    setDashboard((current) => {
      if (!current) return current;
      const carriage = current.carriages.find((item) => item.id === carriageId);
      if (!carriage) return current;
      return {
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
    });
  };

  const handleLockComposition = async () => {
    setLocking(true);
    try {
      const result = await dependencies.lockComposition(dashboard.event.id);
      setDashboard((current) => current ? {
        ...current,
        event: {
          ...current.event,
          compositionLocked: true,
          registrationOpen: result.registrationOpen,
        },
      } : current);
    } finally {
      setLocking(false);
    }
  };

  return (
    <main className="admin-shell">
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
      />
    </main>
  );
}
