import { useState } from 'react';
import type { CarriageSummary } from '../../registration/registration.types';
import type { OwnerCarriageCall } from '../../carriages/carriageCalls.service';

type AdminCarriageCallsProps = {
  carriages: CarriageSummary[];
  initialActiveCall?: OwnerCarriageCall | null;
  onSend: (
    carriageIds: string[],
    message: string,
    showOnScreen: boolean,
  ) => Promise<OwnerCarriageCall>;
  onClear: (callId: string, carriageIds: string[]) => Promise<void>;
  onShowMap?: () => Promise<void>;
};

export function AdminCarriageCalls({
  carriages,
  initialActiveCall = null,
  onSend,
  onClear,
  onShowMap,
}: AdminCarriageCallsProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [showOnScreen, setShowOnScreen] = useState(false);
  const [activeCall, setActiveCall] = useState<OwnerCarriageCall | null>(initialActiveCall);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [showingMap, setShowingMap] = useState(false);

  const toggle = (carriageId: string) => {
    setSelected((current) => current.includes(carriageId)
      ? current.filter((id) => id !== carriageId)
      : [...current, carriageId]);
    setError('');
  };

  const send = async () => {
    const normalizedMessage = message.trim();
    if (selected.length === 0) {
      setError('Выберите хотя бы один вагон.');
      return;
    }
    if (!normalizedMessage) {
      setError('Введите сообщение для вагонов.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const next = await onSend(selected, normalizedMessage, showOnScreen);
      setActiveCall(next);
      setMessage('');
    } catch {
      setError('Не удалось отправить вызов. Проверьте связь и попробуйте снова.');
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    if (!activeCall) return;
    const { callId, targetCarriageIds } = activeCall;
    await onClear(callId, targetCarriageIds);
    setActiveCall(null);
  };

  const showMap = async () => {
    if (!onShowMap || showingMap) return;
    setShowingMap(true);
    setError('');
    try {
      await onShowMap();
    } catch {
      setError('Не удалось показать карту на общем экране. Проверьте связь и попробуйте снова.');
    } finally {
      setShowingMap(false);
    }
  };

  return (
    <section className="admin-carriage-calls" aria-label="Вызовы вагонов">
      <header>
        <p className="eyebrow">ПОЕЗД ВИКТОРА</p>
        <h2>Вызвать вагон</h2>
      </header>

      {activeCall && (
        <div className="admin-active-call" role="status">
          <strong>ВЫЗОВ АКТИВЕН</strong>
          <p>{activeCall.message}</p>
          <button type="button" className="registration-secondary" onClick={() => void clear()}>
            СНЯТЬ ВЫЗОВ
          </button>
        </div>
      )}

      <div className="admin-carriage-call-grid">
        {carriages.map((carriage) => (
          <label key={carriage.id} className="admin-carriage-call-option">
            <input
              type="checkbox"
              checked={selected.includes(carriage.id)}
              onChange={() => toggle(carriage.id)}
              aria-label={`Выбрать ${carriage.label}`}
            />
            <span style={{ '--carriage-accent': carriage.accentHex } as React.CSSProperties}>
              {carriage.label}
            </span>
          </label>
        ))}
      </div>

      <label className="registration-form">
        <span>Сообщение вагонам</span>
        <textarea
          aria-label="Сообщение вагонам"
          value={message}
          onChange={(event) => { setMessage(event.target.value); setError(''); }}
          placeholder="Например: ваш состав отправляется на бар"
        />
      </label>

      <label className="admin-checkbox-row">
        <input
          type="checkbox"
          checked={showOnScreen}
          onChange={(event) => setShowOnScreen(event.target.checked)}
          aria-label="Показать также на общем экране"
        />
        <span>Показать также на общем экране</span>
      </label>

      {error && <p className="registration-error" role="alert">{error}</p>}

      <button
        type="button"
        className="registration-submit"
        disabled={sending}
        onClick={() => void send()}
      >
        {sending ? 'ОТПРАВЛЯЕМ…' : 'ОТПРАВИТЬ ВЫЗОВ'}
      </button>

      {onShowMap && (
        <button
          type="button"
          className="registration-secondary"
          disabled={showingMap}
          onClick={() => void showMap()}
        >
          {showingMap ? 'ПОКАЗЫВАЕМ КАРТУ…' : 'ПОКАЗАТЬ КАРТУ ВАГОНОВ НА ОБЩЕМ ЭКРАНЕ'}
        </button>
      )}
    </section>
  );
}
