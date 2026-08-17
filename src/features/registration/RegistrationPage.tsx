import { type FormEvent, useState } from 'react';
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

type RegistrationPageProps = {
  onRegister: (draft: RegistrationDraft) => Promise<RegisteredGuest>;
  initialGuest?: RegisteredGuest | null;
  revealDelayMs?: number;
};

export function RegistrationPage({
  onRegister,
  initialGuest = null,
  revealDelayMs = 900,
}: RegistrationPageProps) {
  const [draft, setDraft] = useState<RegistrationDraft>(initialDraft);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [status, setStatus] = useState<'form' | 'registering' | 'routing' | 'ticket'>(
    initialGuest ? 'ticket' : 'form',
  );
  const [registeredGuest, setRegisteredGuest] = useState<RegisteredGuest | null>(initialGuest);
  const [submitError, setSubmitError] = useState('');

  const update = (field: keyof RegistrationDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  };

  const revealTicket = (guest: RegisteredGuest) => {
    setRegisteredGuest(guest);
    if (revealDelayMs <= 0) {
      setStatus('ticket');
      return;
    }

    setStatus('routing');
    window.setTimeout(() => setStatus('ticket'), revealDelayMs);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateRegistration(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus('registering');
    setSubmitError('');
    try {
      const guest = await onRegister(normalizeRegistration(draft));
      revealTicket(guest);
    } catch {
      setStatus('form');
      setSubmitError('Не получилось зарегистрироваться. Проверьте связь и попробуйте ещё раз.');
    }
  };

  if (status === 'ticket' && registeredGuest) {
    return (
      <main className="registration-shell registration-shell--ticket">
        <section className="registration-success" aria-live="polite">
          <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ В СОСТАВ</p>
          <VirtualTicket guest={registeredGuest} />
          <p className="registration-hint">Сохраните этот экран — билет останется доступен в вашем профиле весь вечер.</p>
        </section>
      </main>
    );
  }

  if (status === 'routing') {
    return (
      <main className="registration-shell">
        <section className="registration-routing" aria-live="polite">
          <p className="eyebrow">РЕГИСТРАЦИЯ ЗАВЕРШЕНА</p>
          <h1>ФОРМИРУЕМ МАРШРУТ…</h1>
          <div className="registration-route-line" aria-hidden="true"><span /></div>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-shell">
      <section className="registration-card">
        <header className="registration-heading">
          <p className="eyebrow">ПОЕЗД ВИКТОРА · 30.08.2026</p>
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
              placeholder="Например: друг Вити, подруга Лизы"
              value={draft.affiliationDetail}
              onChange={(event) => update('affiliationDetail', event.target.value)}
            />
          </label>

          {submitError && <p className="registration-error" role="alert">{submitError}</p>}

          <button className="registration-submit" type="submit" disabled={status === 'registering'}>
            {status === 'registering' ? 'РЕГИСТРИРУЕМ…' : 'ПОЛУЧИТЬ БИЛЕТ'}
          </button>
        </form>
      </section>
    </main>
  );
}
