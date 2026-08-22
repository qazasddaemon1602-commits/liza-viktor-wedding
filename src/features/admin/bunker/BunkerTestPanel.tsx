import { useState } from 'react';
import { bunkerStageLabel } from '../../bunker/v2/labels';

const ITEMS = [
  ['medkit', 'Аптечка'],
  ['radio', 'Рация'],
  ['generator', 'Генератор'],
  ['tools', 'Инструменты'],
  ['water', 'Вода'],
  ['gas_mask', 'Противогаз'],
] as const;

export type BunkerTestPanelState = {
  gameMode: 'production' | 'test' | 'idle';
  globalState: string | null;
};

type Props = {
  state: BunkerTestPanelState;
  onSeed?: (count: number) => Promise<void> | void;
  onPrepare?: () => Promise<void> | void;
  onAccelerate?: () => Promise<void> | void;
  onSimulate?: () => Promise<void> | void;
  onResetProgress?: () => Promise<void> | void;
  onResetRegistrations?: (confirmation: string) => Promise<void> | void;
  onFullReset?: (confirmation: string) => Promise<void> | void;
  onSetInventory?: (input: {
    wagonNumber: number;
    itemKey: string;
    quantity: number;
  }) => Promise<void> | void;
  onSetWagonState?: (input: {
    wagonNumber: number;
    power: 'stable' | 'unstable' | 'offline';
    communication: 'working' | 'degraded' | 'offline';
    navigation: 'working' | 'degraded' | 'offline';
  }) => Promise<void> | void;
};

export function BunkerTestPanel({
  state,
  onSeed,
  onPrepare,
  onAccelerate,
  onSimulate,
  onResetProgress,
  onResetRegistrations,
  onFullReset,
  onSetInventory,
  onSetWagonState,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [wagon, setWagon] = useState(1);
  const [item, setItem] = useState('medkit');
  const [quantity, setQuantity] = useState(1);
  const [power, setPower] = useState<'stable' | 'unstable' | 'offline'>('stable');
  const [communication, setCommunication] = useState<'working' | 'degraded' | 'offline'>('working');
  const [navigation, setNavigation] = useState<'working' | 'degraded' | 'offline'>('working');
  const [registrationConfirm, setRegistrationConfirm] = useState('');
  const [fullConfirm, setFullConfirm] = useState('');

  const run = (action: () => Promise<void> | void) => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(action()).finally(() => setBusy(false));
  };

  const test = state.gameMode === 'test';
  const production = state.gameMode === 'production';

  return (
    <section className="admin-bunker-test-panel" aria-label="Репетиция игры">
      <header>
        <h2>РЕПЕТИЦИЯ ИГРЫ</h2>
        <strong>
          {test
            ? 'ТЕСТОВЫЙ РЕЖИМ ВКЛЮЧЁН'
            : production
              ? 'ИДЁТ БОЕВАЯ ИГРА'
              : 'ТЕСТ НЕ ЗАПУЩЕН'}
        </strong>
      </header>
      <p>Эти инструменты работают только в режиме репетиции и не могут изменить активную боевую игру.</p>

      <div className="admin-bunker-test-panel__seed">
        <span>Создать тестовый состав:</span>
        {[15, 20, 30, 40].map((count) => (
          <button
            key={count}
            type="button"
            disabled={busy || production}
            onClick={() => run(() => onSeed?.(count))}
          >
            {count} ГОСТЕЙ
          </button>
        ))}
        <button
          type="button"
          disabled={busy || production}
          onClick={() => run(() => onPrepare?.())}
        >
          ПОДГОТОВИТЬ ТЕСТОВУЮ ИГРУ
        </button>
      </div>

      <div className="admin-bunker-test-panel__runtime">
        <button type="button" disabled={busy || !test} onClick={() => run(() => onAccelerate?.())}>
          УСКОРИТЬ НА 1 МИНУТУ
        </button>
        <button type="button" disabled={busy || !test} onClick={() => run(() => onSimulate?.())}>
          СИМУЛИРОВАТЬ ТЕКУЩИЙ ЭТАП
        </button>
        <span>Сейчас: {state.globalState ? bunkerStageLabel(state.globalState) : 'ожидание'}</span>
      </div>

      <details>
        <summary>Ручная настройка вагона</summary>
        <label>
          Вагон
          <select value={wagon} onChange={(event) => setWagon(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((number) => (
              <option key={number} value={number}>ВАГОН №{number}</option>
            ))}
          </select>
        </label>
        <label>
          Предмет
          <select value={item} onChange={(event) => setItem(event.target.value)}>
            {ITEMS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          Количество
          <input
            type="number"
            min={0}
            max={9}
            value={quantity}
            onChange={(event) => setQuantity(
              Math.max(0, Math.min(9, Number(event.target.value) || 0)),
            )}
          />
        </label>
        <button
          type="button"
          disabled={busy || !test}
          onClick={() => run(() => onSetInventory?.({ wagonNumber: wagon, itemKey: item, quantity }))}
        >
          ПРИМЕНИТЬ ЗАПАС
        </button>

        <label>
          Питание
          <select value={power} onChange={(event) => setPower(event.target.value as typeof power)}>
            <option value="stable">Стабильно</option>
            <option value="unstable">Нестабильно</option>
            <option value="offline">Отключено</option>
          </select>
        </label>
        <label>
          Связь
          <select
            value={communication}
            onChange={(event) => setCommunication(event.target.value as typeof communication)}
          >
            <option value="working">Работает</option>
            <option value="degraded">С перебоями</option>
            <option value="offline">Нет связи</option>
          </select>
        </label>
        <label>
          Навигация
          <select
            value={navigation}
            onChange={(event) => setNavigation(event.target.value as typeof navigation)}
          >
            <option value="working">Работает</option>
            <option value="degraded">С перебоями</option>
            <option value="offline">Отключена</option>
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !test}
          onClick={() => run(() => onSetWagonState?.({
            wagonNumber: wagon,
            power,
            communication,
            navigation,
          }))}
        >
          ПРИМЕНИТЬ СОСТОЯНИЕ
        </button>
      </details>

      <details>
        <summary>Сбросы</summary>
        <button
          type="button"
          disabled={busy || production}
          onClick={() => run(() => onResetProgress?.())}
        >
          СБРОСИТЬ ТОЛЬКО ИГРОВОЙ ПРОГРЕСС
        </button>
        <label>
          Для удаления игры и регистраций введите: СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ
          <input value={registrationConfirm} onChange={(event) => setRegistrationConfirm(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={busy || production || registrationConfirm !== 'СБРОСИТЬ ИГРУ И РЕГИСТРАЦИИ'}
          onClick={() => run(() => onResetRegistrations?.(registrationConfirm))}
        >
          СБРОСИТЬ ИГРУ + РЕГИСТРАЦИИ
        </button>
        <label>
          Для полного тестового сброса введите: СБРОСИТЬ
          <input value={fullConfirm} onChange={(event) => setFullConfirm(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={busy || production || fullConfirm !== 'СБРОСИТЬ'}
          onClick={() => run(() => onFullReset?.(fullConfirm))}
        >
          ПОЛНЫЙ СБРОС ВЕЧЕРА
        </button>
        <small>Ответы Лизы и Виктора при полном тестовом сбросе сохраняются.</small>
      </details>
    </section>
  );
}
