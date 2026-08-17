import { useCallback, useEffect, useState } from 'react';
import { RegistrationPage } from './RegistrationPage';
import type { RegistrationDraft } from './registrationModel';
import type { RegisteredGuest } from './registration.types';
import type { RecoveryResult, RegistrationResult, RestoreResult } from './registration.service';

export type JoinPageDependencies = {
  getDeviceKey: () => string;
  restore: (deviceKey: string) => Promise<RestoreResult>;
  register: (draft: RegistrationDraft, confirmDuplicate?: boolean) => Promise<RegistrationResult>;
  recover: (deviceKey: string, recoveryCode: string) => Promise<RecoveryResult>;
};

type JoinPageProps = {
  dependencies: JoinPageDependencies;
  revealDelayMs?: number;
};

export function JoinPage({ dependencies, revealDelayMs }: JoinPageProps) {
  const [guest, setGuest] = useState<RegisteredGuest | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recovering, setRecovering] = useState(false);

  const restore = useCallback(async () => {
    setState('loading');
    try {
      const result = await dependencies.restore(dependencies.getDeviceKey());
      if (result.status === 'restored') {
        setGuest(result.guest);
      } else {
        setGuest(null);
      }
      setState('ready');
    } catch {
      setState('error');
    }
  }, [dependencies]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const register = async (draft: RegistrationDraft, confirmDuplicate?: boolean) => {
    const result = await dependencies.register(draft, confirmDuplicate);
    if (result.status === 'duplicate_warning') return result;
    setGuest(result.guest);
    return result.guest;
  };

  const recover = async () => {
    const normalizedCode = recoveryCode.trim().toUpperCase();
    if (!normalizedCode) {
      setRecoveryError('Введите код восстановления.');
      return;
    }

    setRecovering(true);
    setRecoveryError('');
    try {
      const result = await dependencies.recover(dependencies.getDeviceKey(), normalizedCode);
      if (result.status === 'recovered') {
        setGuest(result.guest);
        setRecoveryOpen(false);
        return;
      }
      if (result.status === 'device_already_bound') {
        setRecoveryError('Этот телефон уже привязан к другому билету. Обратитесь к организатору.');
        return;
      }
      setRecoveryError('Код недействителен или уже истёк. Попросите организатора выдать новый.');
    } catch {
      setRecoveryError('Не удалось проверить код. Проверьте интернет и попробуйте снова.');
    } finally {
      setRecovering(false);
    }
  };

  if (state === 'loading') {
    return (
      <main className="registration-shell">
        <section className="registration-routing" aria-live="polite">
          <p className="eyebrow">ПОЕЗД ВИКТОРА</p>
          <h1>ПРОВЕРЯЕМ БИЛЕТ…</h1>
          <div className="registration-route-line" aria-hidden="true"><span /></div>
        </section>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className="registration-shell">
        <section className="registration-card registration-join-error" role="alert">
          <p className="eyebrow">СВЯЗЬ С СОСТАВОМ</p>
          <h1>Не удалось проверить билет</h1>
          <p>Интернет мог пропасть на несколько секунд. Повторите проверку — существующий билет не потеряется.</p>
          <button className="registration-submit" type="button" onClick={() => void restore()}>ПОПРОБОВАТЬ СНОВА</button>
        </section>
      </main>
    );
  }

  if (recoveryOpen && !guest) {
    return (
      <main className="registration-shell">
        <section className="registration-card">
          <header className="registration-heading">
            <p className="eyebrow">ВОССТАНОВЛЕНИЕ БИЛЕТА</p>
            <h1>БИЛЕТ УЖЕ БЫЛ?</h1>
            <p>Попросите организатора выдать одноразовый код и введите его здесь.</p>
          </header>
          <div className="registration-form">
            <label>
              <span>Код восстановления</span>
              <input
                autoCapitalize="characters"
                autoComplete="one-time-code"
                value={recoveryCode}
                onChange={(event) => { setRecoveryCode(event.target.value); setRecoveryError(''); }}
                placeholder="AB12-CD34"
              />
            </label>
            {recoveryError && <p className="registration-error" role="alert">{recoveryError}</p>}
            <button className="registration-submit" type="button" disabled={recovering} onClick={() => void recover()}>
              {recovering ? 'ПРОВЕРЯЕМ…' : 'ВОССТАНОВИТЬ БИЛЕТ'}
            </button>
            <button className="registration-secondary" type="button" onClick={() => { setRecoveryOpen(false); setRecoveryError(''); }}>
              ВЕРНУТЬСЯ К РЕГИСТРАЦИИ
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <RegistrationPage
        onRegister={register}
        initialGuest={guest}
        revealDelayMs={revealDelayMs}
      />
      {!guest && (
        <div className="registration-recovery-entry">
          <button className="registration-secondary" type="button" onClick={() => setRecoveryOpen(true)}>
            У МЕНЯ УЖЕ БЫЛ БИЛЕТ
          </button>
        </div>
      )}
    </>
  );
}
