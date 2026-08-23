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

export type GuestReassignmentCommand = {
  guestId: string;
  fromCarriageId: string;
  toCarriageId: string;
};

type RecoveryCodeResult = {
  code: string;
  expiresAt: string;
};

type AdminGuestsPageProps = {
  guests: AdminGuest[];
  carriages?: CarriageSummary[];
  onDelete: (guestId: string) => Promise<void> | void;
  onReassign: (command: GuestReassignmentCommand) => Promise<void> | void;
  onIssueRecovery?: (guestId: string) => Promise<RecoveryCodeResult>;
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

export function AdminGuestsPage({
  guests,
  carriages,
  onDelete,
  onReassign,
  onIssueRecovery,
}: AdminGuestsPageProps) {
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AdminGuest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recoveryGuest, setRecoveryGuest] = useState<AdminGuest | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<RecoveryCodeResult | null>(null);
  const [issuingRecovery, setIssuingRecovery] = useState(false);
  const [reassignment, setReassignment] = useState<Record<string, {
    kind: 'pending' | 'success' | 'error';
    toCarriageId: string;
  }>>({});

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

  const issueRecovery = async (guest: AdminGuest) => {
    if (!onIssueRecovery) return;
    setRecoveryGuest(guest);
    setRecoveryCode(null);
    setIssuingRecovery(true);
    try {
      const result = await onIssueRecovery(guest.id);
      setRecoveryCode(result);
    } finally {
      setIssuingRecovery(false);
    }
  };

  const reassign = async (guest: AdminGuest, toCarriageId: string) => {
    const command = { guestId: guest.id, fromCarriageId: guest.carriage.id, toCarriageId };
    setReassignment((current) => ({ ...current, [guest.id]: { kind: 'pending', toCarriageId } }));
    try {
      await onReassign(command);
      setReassignment((current) => ({ ...current, [guest.id]: { kind: 'success', toCarriageId } }));
    } catch {
      setReassignment((current) => ({ ...current, [guest.id]: { kind: 'error', toCarriageId } }));
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
        {filteredGuests.map((guest) => {
          const feedback = reassignment[guest.id];
          const target = carriages?.find((carriage) => carriage.id === feedback?.toCarriageId);
          return (
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
              {carriages && carriages.length > 0 && (
                <label className="admin-carriage-select">
                  <span className="sr-only">Вагон {guest.firstName} {guest.lastName}</span>
                  <select
                    aria-label={`Вагон ${guest.firstName} ${guest.lastName}`}
                    value={guest.carriage.id}
                    disabled={feedback?.kind === 'pending'}
                    onChange={(event) => void reassign(guest, event.target.value)}
                  >
                    {carriages.map((carriage) => (
                      <option key={carriage.id} value={carriage.id}>{carriage.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {feedback?.kind === 'pending' && <span>ПЕРЕСАЖИВАЕМ…</span>}
              {feedback?.kind === 'success' && (
                <p role="status">{guest.firstName} {guest.lastName}: назначен {target?.label ?? 'новый вагон'}.</p>
              )}
              {feedback?.kind === 'error' && (
                <p role="alert">
                  Не удалось пересадить. Остаётся {guest.carriage.label}.{' '}
                  <button type="button" onClick={() => void reassign(guest, feedback.toCarriageId)}>ПОВТОРИТЬ</button>
                </p>
              )}
            </div>

            <div className="admin-guest-card__actions">
              {onIssueRecovery && (
                <button
                  className="registration-secondary"
                  type="button"
                  aria-label={`ВЫДАТЬ ДОСТУП ЗАНОВО ${guest.firstName} ${guest.lastName}`}
                  onClick={() => void issueRecovery(guest)}
                >
                  ДОСТУП ЗАНОВО
                </button>
              )}
              <button
                className="admin-danger-link"
                type="button"
                aria-label={`УДАЛИТЬ ${guest.firstName} ${guest.lastName}`}
                onClick={() => setPendingDelete(guest)}
              >
                УДАЛИТЬ
              </button>
            </div>
          </article>
        );})}
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

      {recoveryGuest && (
        <div className="admin-confirm-backdrop" role="presentation">
          <section className="admin-confirm" role="dialog" aria-modal="true" aria-labelledby="recovery-code-title">
            <p className="eyebrow">ВОССТАНОВЛЕНИЕ БИЛЕТА</p>
            <h3 id="recovery-code-title">{recoveryGuest.firstName} {recoveryGuest.lastName}</h3>
            {issuingRecovery && <p>Создаём одноразовый код…</p>}
            {recoveryCode && (
              <>
                <strong className="admin-recovery-code">{recoveryCode.code}</strong>
                <p>Код одноразовый и действует ограниченное время. Передайте его только этому гостю.</p>
                <small>Истекает: {recoveryCode.expiresAt}</small>
              </>
            )}
            <div className="admin-confirm__actions">
              <button className="registration-secondary" type="button" onClick={() => { setRecoveryGuest(null); setRecoveryCode(null); }}>
                ЗАКРЫТЬ
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
