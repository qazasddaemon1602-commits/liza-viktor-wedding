import { useMemo, useState } from 'react';
import type { CarriageSummary } from '../../registration/registration.types';

export type AdminGuest = {
  id: string;
  firstName: string;
  lastName: string;
  affiliationType: string;
  affiliationDetail: string;
  ticketNumber: string;
  registeredAt: string;
  carriage: CarriageSummary;
};

type AdminGuestsPageProps = {
  guests: AdminGuest[];
  onDelete: (guestId: string) => Promise<void> | void;
  onReassign: (guestId: string, carriageId: string) => Promise<void> | void;
};

const affiliationLabels: Record<string, string> = {
  liza: 'Со стороны Лизы',
  viktor: 'Со стороны Виктора',
  common: 'Общие друзья',
  family: 'Семья / родственники',
  colleagues: 'Коллеги',
  other: 'Другое',
};

function searchableGuest(guest: AdminGuest) {
  return [
    guest.firstName,
    guest.lastName,
    guest.affiliationDetail,
    affiliationLabels[guest.affiliationType] ?? guest.affiliationType,
    guest.carriage.label,
    guest.ticketNumber,
  ].join(' ').toLocaleLowerCase('ru-RU');
}

export function AdminGuestsPage({ guests, onDelete }: AdminGuestsPageProps) {
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminGuest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) return guests;
    return guests.filter((guest) => searchableGuest(guest).includes(normalized));
  }, [guests, query]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="admin-guests">
      <header className="admin-section-header">
        <div>
          <p className="eyebrow">ПАССАЖИРЫ</p>
          <h2>Зарегистрировано: {guests.length}</h2>
        </div>
        <label className="admin-search">
          <span>Поиск гостей</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, фамилия, вагон…"
          />
        </label>
      </header>

      <div className="admin-guest-list">
        {filteredGuests.map((guest) => (
          <article className="admin-guest-card" key={guest.id}>
            <div className="admin-guest-card__identity">
              <span
                className="admin-carriage-dot"
                style={{ backgroundColor: guest.carriage.accentHex }}
                aria-hidden="true"
              />
              <div>
                <h3>{guest.firstName} {guest.lastName}</h3>
                <p>{affiliationLabels[guest.affiliationType] ?? guest.affiliationType}</p>
                {guest.affiliationDetail && <small>{guest.affiliationDetail}</small>}
              </div>
            </div>

            <div className="admin-guest-card__meta">
              <strong>{guest.carriage.label}</strong>
              <span>{guest.ticketNumber}</span>
              <time dateTime={guest.registeredAt}>{guest.registeredAt}</time>
            </div>

            <button
              className="admin-danger-link"
              type="button"
              aria-label={`УДАЛИТЬ ${guest.firstName} ${guest.lastName}`}
              onClick={() => setPendingDelete(guest)}
            >
              УДАЛИТЬ
            </button>
          </article>
        ))}
        {filteredGuests.length === 0 && (
          <p className="admin-empty">Никого не нашли. Общий список гостей не изменён.</p>
        )}
      </div>

      {pendingDelete && (
        <div className="admin-confirm-backdrop" role="presentation">
          <section className="admin-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-guest-title">
            <p className="eyebrow">ПОДТВЕРЖДЕНИЕ</p>
            <h3 id="delete-guest-title">Удалить регистрацию {pendingDelete.firstName} {pendingDelete.lastName}?</h3>
            <p>Это действие предназначено для дублей и ошибочных регистраций. Позже здесь также покажем, какие голоса или турнирные данные будут затронуты.</p>
            <div className="admin-confirm__actions">
              <button className="admin-danger-button" type="button" disabled={deleting} onClick={() => void confirmDelete()}>
                {deleting ? 'УДАЛЯЕМ…' : 'ДА, УДАЛИТЬ'}
              </button>
              <button className="registration-secondary" type="button" disabled={deleting} onClick={() => setPendingDelete(null)}>
                ОТМЕНА
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
