import { useCallback, useEffect, useState } from 'react';
import { RegistrationPage } from './RegistrationPage';
import type { RegistrationDraft } from './registrationModel';
import type { RegisteredGuest } from './registration.types';
import type { RegistrationResult, RestoreResult } from './registration.service';

export type JoinPageDependencies = {
  getDeviceKey: () => string;
  restore: (deviceKey: string) => Promise<RestoreResult>;
  register: (draft: RegistrationDraft, confirmDuplicate?: boolean) => Promise<RegistrationResult>;
};

type JoinPageProps = {
  dependencies: JoinPageDependencies;
  revealDelayMs?: number;
};

export function JoinPage({ dependencies, revealDelayMs }: JoinPageProps) {
  const [guest, setGuest] = useState<RegisteredGuest | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

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

  return (
    <RegistrationPage
      onRegister={register}
      initialGuest={guest}
      revealDelayMs={revealDelayMs}
    />
  );
}
