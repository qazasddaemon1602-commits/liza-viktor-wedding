import { type FormEvent, useEffect, useState } from 'react';
import { SceneTransition } from '../screen/SceneTransition';
import {
  normalizeRegistration,
  validateRegistration,
  type RegistrationDraft,
  type RegistrationErrors,
} from './registrationModel';
import type { RegisteredGuest } from './registration.types';
import { VirtualTicket } from './VirtualTicket';

const affiliationOptions = [
  { value: 'liza', label: 'Со стороны Лизы' },
  { value: 'viktor', label: 'Со стороны Виктора' },
  { value: 'common', label: 'Общие друзья' },
  { value: 'family', label: 'Семья / родственники' },
  { value: 'colleagues', label: 'Коллеги' },
  { value: 'other', label: 'Другое' },
] as const;

const initialDraft: RegistrationDraft = {
  firstName: '',
  lastName: '',
  affiliationType: '',
  affiliationDetail: '',
};

type DuplicateWarning = {
  status: 'duplicate_warning';
  publicName: string;
};

type RegistrationSubmitResult = RegisteredGuest | DuplicateWarning;

type RegistrationPageProps = {
  onRegister: (draft: RegistrationDraft, confirmDuplicate?: boolean) => Promise<RegistrationSubmitResult>;
  initialGuest?: RegisteredGuest | null;
  revealDelayMs?: number;
  ticketHoldMs?: number;
  onTicketReady?: (guest: RegisteredGuest) => void;
};

function isDuplicateWarning(result: RegistrationSubmitResult): result is DuplicateWarning {
  return 'status' in result && result.status === 'duplicate_warning';
}

export function RegistrationPage({
  onRegister,
  initialGuest = null,
  revealDelayMs = 900,
  ticketHoldMs = 2400,
  onTicketReady,
}: RegistrationPageProps) {
  const [draft, setDraft] = useState<RegistrationDraft>(initialDraft);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [status, setStatus] = useState<'form' | 'registering' | 'duplicate' | 'routing' | 'ticket'>(
    initialGuest ? 'ticket' : 'form',
  );
  const [registeredGuest, setRegisteredGuest] = useState<RegisteredGuest | null>(initialGuest);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [pendingDraft, setPendingDraft] = useState<RegistrationDraft | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [handoffGuest, setHandoffGuest] = useState<RegisteredGuest | null>(null);

  useEffect(() => {
    if (status !== 'ticket' || !handoffGuest || !onTicketReady) return;
    const timer = window.setTimeout(() => {
      onTicketReady(handoffGuest);
      setHandoffGuest(null);
    }, ticketHoldMs);
    return () => window.clearTimeout(timer);
  }, [handoffGuest, onTicketReady, status, ticketHoldMs]);

  const update = (field: keyof RegistrationDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const revealTicket = (guest: RegisteredGuest) => {
    setRegisteredGuest(guest);
    setHandoffGuest(guest);
    setDuplicateWarning(null);
    setPendingDraft(null);
    if (revealDelayMs <= 0) {
      setStatus('ticket');
      return;
    }

    setStatus('routing');
    window.setTimeout(() => setStatus('ticket'), revealDelayMs);
  };

  const handleResult = (result: RegistrationSubmitResult, normalizedDraft: RegistrationDraft) => {
    if (isDuplicateWarning(result)) {
      setDuplicateWarning(result);
      setPendingDraft(normalizedDraft);
      setStatus('duplicate');
      return;
    }
    revealTicket(result);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateRegistration(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const normalizedDraft = normalizeRegistration(draft);
    setStatus('registering');
    setSubmitError('');
    try {
      const result = await onRegister(normalizedDraft);
      handleResult(result, normalizedDraft);
    } catch {
      setStatus('form');
      setSubmitError('Не получилось зарегистрироваться. Проверьте связь и попробуйте ещё раз.');
    }
  };

  const confirmDuplicate = async () => {
    if (!pendingDraft) return;
    setStatus('registering');
    setSubmitError('');
    try {
      const result = await onRegister(pendingDraft, true);
      if (isDuplicateWarning(result)) {
        setDuplicateWarning(result);
        setStatus('duplicate');
        return;
      }
      revealTicket(result);
    } catch {
      setStatus('duplicate');
      setSubmitError('Не получилось подтвердить регистрацию. Попробуйте ещё раз.');
    }
  };

  if (status === 'ticket' && registeredGuest) {
    return (
      <SceneTransition sceneKey={`ticket-${registeredGuest.id}`} label="МАРШРУТ НАЗНАЧЕН" tone="sage">
        <main className="registration-shell registration-ticket-surface registration-shell--ticket">
          <section className="registration-success" aria-live="polite">
            <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ В СОСТАВ</p>
            <VirtualTicket guest={registeredGuest} />
            <p className="registration-hint">Сохраните этот экран — билет останется доступен в вашем профиле весь вечер.</p>
          </section>
        </main>
      </SceneTransition>
    );
  }

  if (status === 'routing') {
    return (
      <SceneTransition sceneKey="registration-routing" label="ПОСАДКА ПОДТВЕРЖДЕНА" tone="sage">
        <main className="registration-shell registration-ticket-surface">
          <section className="registration-routing" aria-live="polite">
            <p className="eyebrow">РЕГИСТРАЦИЯ ЗАВЕРШЕНА</p>
            <h1>ФОРМИРУЕМ МАРШРУТ…</h1>
            <div className="registration-route-line" aria-hidden="true"><span /></div>
          </section>
        </main>
      </SceneTransition>
    );
  }

  if (status === 'duplicate' && duplicateWarning) {
    return (
      <main className="registration-shell registration-ticket-surface">
        <section className="registration-card registration-duplicate" aria-live="polite">
          <p className="eyebrow">ПРОВЕРИМ ПАССАЖИРА</p>
          <h1>{duplicateWarning.publicName} уже зарегистрирован</h1>
          <p>Если это вы — откройте сайт с телефона, на котором регистрировались. Если это другой человек с таким же именем, подтвердите регистрацию.</p>
          {submitError && <p className="registration-error" role="alert">{submitError}</p>}
          <div className="registration-duplicate__actions">
            <button className="registration-submit" type="button" onClick={confirmDuplicate}>ЭТО ДРУГОЙ ЧЕЛОВЕК</button>
            <button className="registration-secondary" type="button" onClick={() => setStatus('form')}>ВЕРНУТЬСЯ</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-shell registration-ticket-surface">
      <section className="registration-card registration-card--form">
        <div className="registration-card__body">
          <header className="registration-heading">
            <p className="eyebrow">ЛИЗА × ВИКТОР · 30.08.2026</p>
            <h1>ВАШ БИЛЕТ ЖДЁТ</h1>
            <p>Представьтесь — и сайт определит ваш вагон-команду на сегодняшний вечер.</p>
          </header>

          <form className="registration-form" onSubmit={submit} noValidate>
            <label>
              <span>Имя</span>
              <input
                autoComplete="given-name"
                value={draft.firstName}
                onChange={(event) => update('firstName', event.target.value)}
                aria-invalid={Boolean(errors.firstName)}
              />
              {errors.firstName && <small role="alert">{errors.firstName}</small>}
            </label>

            <label>
              <span>Фамилия</span>
              <input
                autoComplete="family-name"
                value={draft.lastName}
                onChange={(event) => update('lastName', event.target.value)}
                aria-invalid={Boolean(errors.lastName)}
              />
              {errors.lastName && <small role="alert">{errors.lastName}</small>}
            </label>

            <label>
              <span>С кем вы сегодня?</span>
              <select
                value={draft.affiliationType}
                onChange={(event) => update('affiliationType', event.target.value)}
                aria-invalid={Boolean(errors.affiliationType)}
              >
                <option value="">Выберите вариант</option>
                {affiliationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.affiliationType && <small role="alert">{errors.affiliationType}</small>}
            </label>

            <label>
              <span>Уточнение</span>
              <input
                placeholder="Друг Вити / подруга Лизы"
                value={draft.affiliationDetail}
                onChange={(event) => update('affiliationDetail', event.target.value)}
              />
            </label>

            {submitError && <p className="registration-error" role="alert">{submitError}</p>}

            <button className="registration-submit" type="submit" disabled={status === 'registering'}>
              {status === 'registering' ? 'РЕГИСТРИРУЕМ…' : 'ПОЛУЧИТЬ БИЛЕТ'}
            </button>
          </form>
        </div>

        <aside className="registration-card__stub" aria-hidden="true">
          <span>BOARDING PASS</span>
          <strong>LV</strong>
          <dl>
            <div><dt>DATE</dt><dd>30 AUG 2026</dd></div>
            <div><dt>ROUTE</dt><dd>TYUMEN</dd></div>
            <div><dt>CLASS</dt><dd>GUEST</dd></div>
          </dl>
          <span>ADMIT ONE</span>
        </aside>
      </section>
    </main>
  );
}
