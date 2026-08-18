import { useState } from 'react';
import type { EventTestResetResult } from '../admin.service';

type AdminTestResetPanelProps = {
  guestCount: number;
  onReset: (confirmation: string) => Promise<EventTestResetResult>;
};

export function AdminTestResetPanel({ guestCount, onReset }: AdminTestResetPanelProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EventTestResetResult | null>(null);
  const [error, setError] = useState('');

  const confirmReset = async () => {
    if (confirmation !== 'СБРОСИТЬ' || running) return;
    setRunning(true);
    setError('');
    try {
      const next = await onReset(confirmation);
      setResult(next);
      setOpen(false);
      setConfirmation('');
    } catch {
      setError('Сброс не выполнен. Ничего не повторяйте вслепую — проверьте связь и попробуйте ещё раз.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="admin-test-reset" aria-label="Сброс тестовых данных">
      <div className="admin-test-reset__heading">
        <div>
          <p className="eyebrow">ПЕРЕД ДНЁМ СВАДЬБЫ</p>
          <h2>СБРОС РЕПЕТИЦИИ</h2>
        </div>
        <span>{guestCount} ТЕСТОВЫХ ГОСТЕЙ</span>
      </div>

      <p className="admin-test-reset__note">
        Используйте после финальной репетиции, когда нужно вернуть событие к чистому старту.
      </p>

      {!open && (
        <button
          type="button"
          className="registration-secondary admin-test-reset__open"
          onClick={() => {
            setResult(null);
            setError('');
            setOpen(true);
          }}
        >
          СБРОСИТЬ ТЕСТОВЫЕ ДАННЫЕ
        </button>
      )}

      {open && (
        <div className="admin-test-reset__confirm" role="group" aria-label="Подтверждение сброса">
          <strong>ЭТО УДАЛИТ ДАННЫЕ РЕПЕТИЦИИ</strong>
          <ul>
            <li>Гости, голоса и текущие состояния будут удалены.</li>
            <li>Ответы Лизы и Виктора сохранятся.</li>
            <li>Список вопросов, вагоны и настроенное видео премьеры сохранятся.</li>
            <li>Регистрация снова откроется, следующий билет будет LV-001.</li>
          </ul>

          <label>
            <span>Введите СБРОСИТЬ</span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="admin-test-reset__actions">
            <button
              type="button"
              className="registration-secondary"
              onClick={() => {
                setOpen(false);
                setConfirmation('');
                setError('');
              }}
              disabled={running}
            >
              ОТМЕНА
            </button>
            <button
              type="button"
              className="registration-submit"
              disabled={confirmation !== 'СБРОСИТЬ' || running}
              onClick={() => void confirmReset()}
            >
              {running ? 'СБРАСЫВАЕМ…' : 'ПОДТВЕРДИТЬ СБРОС'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <p className="admin-test-reset__success" role="status">
          СБРОШЕНО · удалено гостей: {result.deletedGuests} · сохранено ответов: {result.preservedCoupleAnswers}
        </p>
      )}
      {error && <p className="admin-test-reset__error" role="alert">{error}</p>}
    </section>
  );
}