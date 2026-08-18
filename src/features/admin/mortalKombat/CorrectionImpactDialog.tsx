import type { MkAffectedMatch } from '../../mortalKombat/mk.owner.service';

type CorrectionImpactDialogProps = {
  affected: MkAffectedMatch[];
  onCancel: () => void;
  onConfirm: () => void;
};

const roundLabels = {
  r16: '1/8 ФИНАЛА',
  qf: '1/4 ФИНАЛА',
  sf: '1/2 ФИНАЛА',
  final: 'ФИНАЛ',
} as const;

export function CorrectionImpactDialog({ affected, onCancel, onConfirm }: CorrectionImpactDialogProps) {
  return (
    <div className="mk-impact-backdrop" role="presentation">
      <section className="mk-impact-dialog" role="dialog" aria-modal="true" aria-labelledby="mk-impact-title">
        <p className="eyebrow">ОПАСНОЕ ИСПРАВЛЕНИЕ</p>
        <h3 id="mk-impact-title">ИЗМЕНЕНИЕ ЗАТРОНЕТ СЛЕДУЮЩИЕ БОИ</h3>
        <p>
          В этих матчах уже есть результат. Чтобы исправить более ранний бой, их нужно очистить и сыграть ветку заново.
        </p>
        <ul>
          {affected.map((match) => (
            <li key={match.matchId}>
              {roundLabels[match.round]} · БОЙ {match.position}
            </li>
          ))}
        </ul>
        <div className="mk-impact-actions">
          <button type="button" className="registration-secondary" onClick={onCancel}>
            ОТМЕНА
          </button>
          <button type="button" className="registration-submit" onClick={onConfirm}>
            СБРОСИТЬ ЗАТРОНУТЫЕ РЕЗУЛЬТАТЫ
          </button>
        </div>
      </section>
    </div>
  );
}
