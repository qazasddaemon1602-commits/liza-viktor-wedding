import { useEffect, useState } from 'react';
import {
  balancedCarriageSizes,
  recommendCarriageCount,
  type SupportedCarriageCount,
} from '../../carriages/carriageAllocator';

type AdminCarriageDistributionProps = {
  guestCount: number;
  compositionLocked: boolean;
  activeCarriageCount?: SupportedCarriageCount;
  onAccept: (carriageCount: number) => Promise<void> | void;
};

const SUPPORTED_COUNTS: SupportedCarriageCount[] = [2, 3, 4, 5];

export function AdminCarriageDistribution({
  guestCount,
  compositionLocked,
  activeCarriageCount,
  onAccept,
}: AdminCarriageDistributionProps) {
  const recommended = recommendCarriageCount(guestCount);
  const [selected, setSelected] = useState<SupportedCarriageCount>(
    compositionLocked && activeCarriageCount ? activeCarriageCount : recommended,
  );
  const [manuallySelected, setManuallySelected] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const sizes = balancedCarriageSizes(guestCount, selected);
  const smallestTeam = Math.min(...sizes);

  useEffect(() => {
    if (compositionLocked && activeCarriageCount) {
      setSelected(activeCarriageCount);
      return;
    }
    if (!compositionLocked && !manuallySelected) setSelected(recommended);
  }, [activeCarriageCount, compositionLocked, manuallySelected, recommended]);

  const accept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      await onAccept(selected);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <section className="admin-carriage-distribution" aria-labelledby="carriage-distribution-title">
      <header>
        <p className="eyebrow">ПОСЛЕДНИЙ ВАГОН · СОСТАВ</p>
        <h2 id="carriage-distribution-title">РАСПРЕДЕЛЕНИЕ ПО ВАГОНАМ</h2>
      </header>

      <p>Участников в распределении: {guestCount}</p>
      <p>Рекомендуемое количество вагонов: {recommended}</p>

      {guestCount < 12 && (
        <p className="admin-carriage-distribution__warning">
          Для полноценного режима «Последний вагон» рекомендуется минимум 12 участников.
        </p>
      )}

      {!compositionLocked && (
        <label>
          <span>Количество вагонов</span>
          <select
            value={selected}
            onChange={(event) => {
              setManuallySelected(true);
              setSelected(Number(event.target.value) as SupportedCarriageCount);
            }}
          >
            {SUPPORTED_COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
      )}

      <div aria-label="Предлагаемое распределение">
        {sizes.map((size, index) => <p key={index}>Вагон №{index + 1} — {size}</p>)}
      </div>

      {!compositionLocked && smallestTeam < 5 && (
        <p className="admin-carriage-distribution__warning">
          В выбранной схеме команды получаются меньше пяти человек. Рекомендуем уменьшить количество вагонов.
        </p>
      )}

      {compositionLocked ? (
        <strong>СОСТАВ ЗАФИКСИРОВАН</strong>
      ) : (
        <button type="button" disabled={accepting} onClick={() => void accept()}>
          {accepting ? 'ФИКСИРУЕМ…' : 'ПРИНЯТЬ РАСПРЕДЕЛЕНИЕ'}
        </button>
      )}
    </section>
  );
}
