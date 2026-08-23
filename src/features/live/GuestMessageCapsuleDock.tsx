import { useEffect, useState } from 'react';
import type {
  GuestMessageCapsuleState,
  SaveGuestMessageResult,
} from './messageCapsule.service';

type Props = {
  load: () => Promise<GuestMessageCapsuleState>;
  save: (message: string) => Promise<SaveGuestMessageResult>;
};

export function GuestMessageCapsuleDock({ load, save }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GuestMessageCapsuleState | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    setBusy(true);
    setFeedback('');
    void load()
      .then((next) => {
        if (!active) return;
        setState(next);
        if (next.status === 'ready') setMessage(next.message ?? '');
      })
      .catch(() => {
        if (active) setFeedback('НЕ УДАЛОСЬ ОТКРЫТЬ КАПСУЛУ');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [load, open]);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || state?.status !== 'ready' || !state.open || busy) return;
    setBusy(true);
    setFeedback('');
    try {
      const result = await save(trimmed);
      if (result.status === 'closed') {
        setState({ ...state, open: false });
        setFeedback('ПРИЁМ СООБЩЕНИЙ ЗАКРЫТ');
        return;
      }
      setMessage(result.message);
      setState({ ...state, message: result.message, updatedAt: result.updatedAt });
      setFeedback('СОХРАНЕНО');
    } catch {
      setFeedback('НЕ УДАЛОСЬ СОХРАНИТЬ');
    } finally {
      setBusy(false);
    }
  };

  const maxLength = state?.status === 'ready' ? state.maxLength : 280;
  const capsuleOpen = state?.status === 'ready' ? state.open : false;

  return (
    <>
      <button
        type="button"
        className="guest-capsule-launcher"
        aria-label="Открыть капсулу сообщений"
        onClick={() => setOpen(true)}
      >
        КАПСУЛА
      </button>

      {open && (
        <div className="guest-capsule-modal" role="dialog" aria-modal="true" aria-label="Капсула для Лизы и Виктора">
          <button
            type="button"
            className="guest-capsule-modal__backdrop"
            aria-label="Закрыть капсулу"
            onClick={() => setOpen(false)}
          />
          <section className="guest-capsule-card">
            <header>
              <div>
                <p>ЛИЗА × ВИКТОР · КАПСУЛА ВЕЧЕРА</p>
                <h2>ОДНА ФРАЗА ИМ НА ПАМЯТЬ</h2>
              </div>
              <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button>
            </header>

            {busy && !state ? (
              <p className="guest-capsule-card__status">ОТКРЫВАЕМ…</p>
            ) : state?.status === 'not_registered' ? (
              <p className="guest-capsule-card__status">СНАЧАЛА НУЖЕН БИЛЕТ ГОСТЯ.</p>
            ) : state?.status === 'not_found' ? (
              <p className="guest-capsule-card__status">КАПСУЛА ПОКА НЕДОСТУПНА.</p>
            ) : state?.status === 'ready' ? (
              <>
                <p className="guest-capsule-card__hint">
                  Напишите что-то, что Лиза и Виктор смогут перечитать после свадьбы. Ваше имя сохранится вместе с сообщением.
                </p>
                {!capsuleOpen && <strong className="guest-capsule-card__closed">ПРИЁМ СООБЩЕНИЙ ЗАКРЫТ</strong>}
                <label>
                  <span>Сообщение Лизе и Виктору</span>
                  <textarea
                    maxLength={maxLength}
                    rows={5}
                    disabled={!capsuleOpen || busy}
                    value={message}
                    onChange={(event) => {
                      setMessage(event.target.value);
                      setFeedback('');
                    }}
                    aria-label="Сообщение Лизе и Виктору"
                    placeholder="Например: через десять лет перечитайте это и снова выберите друг друга."
                  />
                </label>
                <div className="guest-capsule-card__meta">
                  <span>{message.length} / {maxLength}</span>
                  {feedback && <strong>{feedback}</strong>}
                </div>
                {capsuleOpen && (
                  <button
                    type="button"
                    className="guest-capsule-card__save"
                    disabled={busy || message.trim().length === 0}
                    onClick={() => void submit()}
                  >
                    {busy ? 'СОХРАНЯЕМ…' : 'СОХРАНИТЬ В КАПСУЛУ'}
                  </button>
                )}
              </>
            ) : feedback ? (
              <p className="guest-capsule-card__status">{feedback}</p>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
