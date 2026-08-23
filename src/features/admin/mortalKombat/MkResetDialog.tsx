import { useState } from 'react';
import { useMkDialogFocus } from './useMkDialogFocus';

type MkResetDialogProps = {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (confirmation: string) => void;
};

export function MkResetDialog({ busy, onCancel, onConfirm }: MkResetDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const focus = useMkDialogFocus({ busy, onEscape: onCancel });

  return (
    <section
      ref={focus.dialogRef}
      className="admin-mk-live-note mk-impact-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mk-reset-title"
    >
      <strong id="mk-reset-title">ДЕЙСТВИЕ НЕЛЬЗЯ ОТМЕНИТЬ</strong>
      <p>
        Будут удалены участники MK, сетка и результаты боёв. Регистрации гостей свадьбы и ответы пары сохранятся.
      </p>
      <label>
        <span>Введите СБРОСИТЬ ТУРНИР</span>
        <input
          type="text"
          value={confirmation}
          autoComplete="off"
          disabled={busy}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      <div className="admin-mk-actions">
        <button
          ref={focus.initialFocusRef}
          type="button"
          className="registration-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          ОТМЕНА
        </button>
        <button
          type="button"
          className="registration-submit"
          disabled={busy || confirmation !== 'СБРОСИТЬ ТУРНИР'}
          onClick={() => onConfirm(confirmation)}
        >
          ПОДТВЕРДИТЬ СБРОС ТУРНИРА
        </button>
      </div>
    </section>
  );
}
