import { useCallback, useEffect, useState } from 'react';
import type { GuestBunkerLiveDependencies } from '../bunker/useGuestBunkerLiveState';
import { useGuestBunkerLiveState } from '../bunker/useGuestBunkerLiveState';
import type { GuestActiveCarriageCalls, GuestCarriageCall } from '../carriages/carriageCalls.service';
import { GuestHub } from '../guest/GuestHub';
import { useGuestQuizLiveState, type GuestQuizLiveDependencies } from '../guest/useGuestQuizLiveState';
import { RegistrationPage } from './RegistrationPage';
import type { RegistrationDraft } from './registrationModel';
import type { RegisteredGuest } from './registration.types';
import type { RecoveryResult, RegistrationResult, RestoreResult } from './registration.service';

export type JoinPageDependencies = {
  getDeviceKey: () => string;
  restore: (deviceKey: string) => Promise<RestoreResult>;
  register: (draft: RegistrationDraft, confirmDuplicate?: boolean) => Promise<RegistrationResult>;
  recover: (deviceKey: string, recoveryCode: string) => Promise<RecoveryResult>;
  loadCarriageCalls?: (deviceKey: string) => Promise<GuestActiveCarriageCalls>;
  subscribeToCarriageCalls?: (carriageId: string, callback: () => void) => () => void;
  quiz?: GuestQuizLiveDependencies;
  bunker?: GuestBunkerLiveDependencies;
};

type JoinPageProps = {
  dependencies: JoinPageDependencies;
  revealDelayMs?: number;
};

export function JoinPage({ dependencies, revealDelayMs }: JoinPageProps) {
  const [guest, setGuest] = useState<RegisteredGuest | null>(null);
  const [activeCall, setActiveCall] = useState<GuestCarriageCall | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const quiz = useGuestQuizLiveState({
    dependencies: dependencies.quiz,
    enabled: Boolean(guest && dependencies.quiz),
  });
  const bunker = useGuestBunkerLiveState({
    dependencies: dependencies.bunker,
    enabled: Boolean(guest && dependencies.bunker),
  });

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

  useEffect(() => {
    if (!guest || !dependencies.loadCarriageCalls) {
      setActiveCall(null);
      return;
    }

    let active = true;
    const refresh = async () => {
      try {
        const result = await dependencies.loadCarriageCalls?.(dependencies.getDeviceKey());
        if (!active || !result) return;
        setActiveCall(result.status === 'ok' ? (result.calls[0] ?? null) : null);
      } catch {
        if (active) setActiveCall(null);
      }
    };

    void refresh();
    const unsubscribe = dependencies.subscribeToCarriageCalls?.(guest.carriage.id, () => {
      void refresh();
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [dependencies, guest]);

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
      <main className="registration-shell registration-ticket-surface">
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
      <main className="registration-shell registration-ticket-surface">
        <section className="registration-card registration-join-error" role="alert">
          <p className="eyebrow">СВЯЗЬ С СОСТАВОМ</p>
          <h1>Не удалось проверить билет</h1>
          <p>Интернет мог пропасть на несколько секунд. Повторите проверку — существующий билет не потеряется.</p>
          <button className="registration-submit" type="button" onClick={() => void restore()}>ПОПРОБОВАТЬ СНОВА</button>
        </section>
      </main>
    );
  }

  if (guest) {
    return (
      <GuestHub
        guest={guest}
        activeCall={activeCall}
        bunkerState={bunker.state}
        bunkerRuntime={bunker.runtime}
        bunkerRuntimeLoading={bunker.runtimeLoading}
        bunkerRuntimeError={bunker.runtimeError}
        bunkerFeedback={bunker.feedback}
        bunkerError={bunker.error}
        bunkerSubmitting={bunker.submitting}
        onBunkerMission={(stage, answer) => void bunker.submitMission(stage, answer)}
        onBunkerFinalCode={(code) => void bunker.submitFinalCode(code)}
        quizState={quiz.state}
        quizError={quiz.error}
        quizSubmitting={quiz.submitting}
        onQuizVote={(choice) => void quiz.vote(choice)}
        onQuizDeadline={() => void quiz.reload()}
      />
    );
  }

  if (recoveryOpen) {
    return (
      <main className="registration-shell registration-ticket-surface">
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
        initialGuest={null}
        revealDelayMs={revealDelayMs}
      />
      <div className="registration-recovery-entry registration-ticket-surface">
        <button className="registration-secondary" type="button" onClick={() => setRecoveryOpen(true)}>
          У МЕНЯ УЖЕ БЫЛ БИЛЕТ
        </button>
      </div>
    </>
  );
}
