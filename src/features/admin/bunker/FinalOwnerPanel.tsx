import { useState } from 'react';
import type { FinalScreenModel } from '../../bunker/v2/FinalScreen';
import '../../../styles/admin-bunker-final-guard.css';

export function FinalOwnerPanel({
  model,
  onAddTime,
  onHint,
  onEmergencyOpen,
}: {
  model: FinalScreenModel;
  onAddTime?: () => Promise<void> | void;
  onHint?: () => Promise<void> | void;
  onEmergencyOpen?: () => Promise<void> | void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (
    action: (() => Promise<void> | void) | undefined,
    failureCopy: string,
  ): Promise<boolean> => {
    if (!action || busy) return false;
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch {
      setError(failureCopy);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={`admin-bunker-mission admin-bunker-final${model.unlocked ? ' is-unlocked' : ''}`}
      aria-label="Финал · контроль ведущего"
    >
      <header>
        <h3>ФИНАЛ · 30 МИНУТ ДО БУНКЕРА</h3>
        <strong>
          {Math.floor(model.remainingSeconds / 60)}:{String(model.remainingSeconds % 60).padStart(2, '0')}
        </strong>
      </header>
      <p>{model.solved}/{model.total} параметров подтверждено · неудачных проверок: {model.wrongAttempts}</p>
      <p>Ответы намеренно скрыты. Пульт помогает только временем и подсказками.</p>

      {error && <p role="alert">{error}</p>}

      <div className="admin-bunker-final__actions">
        <button
          type="button"
          disabled={busy || model.unlocked || !onAddTime}
          onClick={() => void run(onAddTime, 'Не удалось добавить время. Проверьте связь и повторите один раз.')}
        >
          +2 МИНУТЫ
        </button>
        <button
          type="button"
          disabled={busy || model.unlocked || model.hintLevel >= 3 || !onHint}
          onClick={() => void run(onHint, 'Не удалось выдать подсказку. Проверьте связь и повторите один раз.')}
        >
          ДАТЬ ПОДСКАЗКУ
        </button>
        {!confirmOpen ? (
          <button
            type="button"
            disabled={busy || model.unlocked || !onEmergencyOpen}
            onClick={() => {
              setError('');
              setConfirmOpen(true);
            }}
          >
            АВАРИЙНО ОТКРЫТЬ
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || model.unlocked || !onEmergencyOpen}
            onClick={() => {
              void run(
                onEmergencyOpen,
                'Аварийное открытие не выполнено. Бункер остаётся закрыт — проверьте связь перед повтором.',
              ).then((completed) => {
                if (completed) setConfirmOpen(false);
              });
            }}
          >
            ПОДТВЕРДИТЬ АВАРИЙНОЕ ОТКРЫТИЕ
          </button>
        )}
      </div>
      {confirmOpen && (
        <p role="alert">
          Аварийное открытие завершит головоломку без правильного кода. Используйте только если гостям нужна помощь или заканчивается время.
        </p>
      )}
    </section>
  );
}
