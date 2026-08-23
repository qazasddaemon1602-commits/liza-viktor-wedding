import type { MkAffectedMatch } from '../../mortalKombat/mk.owner.service';
import { MK_ROUND_LABELS } from '../../mortalKombat/mk.types';
import { useMkDialogFocus } from './useMkDialogFocus';

type CorrectionImpactDialogProps = {
  affected: MkAffectedMatch[];
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function CorrectionImpactDialog({ affected, onCancel, onConfirm, busy = false }: CorrectionImpactDialogProps) {
  const focus = useMkDialogFocus({ busy, onEscape: onCancel });
  return (
    <div className="mk-impact-backdrop" role="presentation">
      <section ref={focus.dialogRef} className="mk-impact-dialog" role="dialog" aria-modal="true" aria-labelledby="mk-impact-title">
        <p className="eyebrow">ОПАСНОЕ ИСПРАВЛЕНИЕ</p>
        <h3 id="mk-impact-title">ИЗМЕНЕНИЕ ЗАТРОНЕТ СЛЕДУЮЩИЕ БОИ</h3>
        <p>
          В этих матчах уже есть результат. Чтобы исправить более ранний бой, их нужно очистить и сыграть ветку заново.
        </p>
        <ul>
          {affected.map((match) => (
            <li key={match.matchId}>
              {MK_ROUND_LABELS[match.round]} · БОЙ {match.position}
            </li>
          ))}
        </ul>
        <div className="mk-impact-actions">
          <button ref={focus.initialFocusRef} type="button" className="registration-secondary" disabled={busy} onClick={onCancel}>
            ОТМЕНА
          </button>
          <button type="button" className="registration-submit" disabled={busy} onClick={onConfirm}>
            СБРОСИТЬ ЗАТРОНУТЫЕ РЕЗУЛЬТАТЫ
          </button>
        </div>
      </section>
    </div>
  );
}
