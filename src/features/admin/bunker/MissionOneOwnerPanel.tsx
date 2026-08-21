import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type MissionOneOwnerMember = {
  guestId: string;
  realName: string;
  profession: string;
};

export type MissionOneOwnerWagon = {
  wagonId: string;
  label: string;
  quota: number;
  status: 'active' | 'completed';
  selectedGuestIds: readonly string[];
  members: readonly MissionOneOwnerMember[];
};

export type MissionOneOwnerReadModel = {
  status: 'active' | 'completed';
  remainingSeconds: number;
  wagons: readonly MissionOneOwnerWagon[];
};

export type MissionOneOwnerOverride = {
  wagonId: string;
  selectedGuestIds: string[];
  reason: string;
};

type MissionOneOwnerPanelProps = {
  model: MissionOneOwnerReadModel;
  onOverride?: (override: MissionOneOwnerOverride) => Promise<void> | void;
};

type OverrideDraft = {
  wagonId: string;
  selectedGuestIds: string[];
  reason: string;
};

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function MissionOneOwnerPanel({ model, onOverride }: MissionOneOwnerPanelProps) {
  const [draft, setDraft] = useState<OverrideDraft | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reviewRef = useRef<HTMLDivElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const applyButtonRef = useRef<HTMLButtonElement>(null);
  const restoreApplyFocusRef = useRef(false);
  const completeCount = model.wagons.filter((wagon) => wagon.status === 'completed').length;
  const editedWagon = draft
    ? model.wagons.find((wagon) => wagon.wagonId === draft.wagonId) ?? null
    : null;
  const selectedMembers = draft && editedWagon
    ? editedWagon.members.filter((member) => draft.selectedGuestIds.includes(member.guestId))
    : [];

  useEffect(() => {
    if (!reviewing) return undefined;
    reviewHeadingRef.current?.focus();
    const dialog = reviewRef.current;
    const background = [...document.body.children].filter((element) => (
      element instanceof HTMLElement && !element.contains(dialog)
    ));
    const previous = background.map((element) => ({
      element,
      inert: element.getAttribute('inert'),
      ariaHidden: element.getAttribute('aria-hidden'),
    }));
    background.forEach((element) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });
    return () => {
      previous.forEach(({ element, inert, ariaHidden }) => {
        if (inert === null) element.removeAttribute('inert');
        else element.setAttribute('inert', inert);
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
    };
  }, [reviewing]);

  useEffect(() => {
    if (!reviewing && restoreApplyFocusRef.current) {
      restoreApplyFocusRef.current = false;
      applyButtonRef.current?.focus();
    }
  }, [reviewing]);

  const openOverride = (wagon: MissionOneOwnerWagon) => {
    setError('');
    setDraft({
      wagonId: wagon.wagonId,
      selectedGuestIds: [...wagon.selectedGuestIds],
      reason: '',
    });
  };

  const toggle = (guestId: string) => {
    if (!draft || !editedWagon) return;
    setDraft((current) => {
      if (!current) return current;
      const selected = current.selectedGuestIds.includes(guestId);
      if (!selected && current.selectedGuestIds.length >= editedWagon.quota) return current;
      return {
        ...current,
        selectedGuestIds: selected
          ? current.selectedGuestIds.filter((id) => id !== guestId)
          : [...current.selectedGuestIds, guestId],
      };
    });
  };

  const submit = async () => {
    if (
      !draft
      || !editedWagon
      || !onOverride
      || draft.selectedGuestIds.length !== editedWagon.quota
      || !draft.reason.trim()
      || busy
    ) return;
    setBusy(true);
    setError('');
    try {
      await onOverride({
        wagonId: draft.wagonId,
        selectedGuestIds: [...draft.selectedGuestIds],
        reason: draft.reason.trim(),
      });
      setReviewing(false);
      setDraft(null);
    } catch {
      setError('Override не применён. Перечитайте прогресс перед повтором.');
    } finally {
      setBusy(false);
    }
  };

  const requestReview = () => {
    if (
      !draft
      || !editedWagon
      || draft.selectedGuestIds.length !== editedWagon.quota
      || !draft.reason.trim()
      || busy
    ) return;
    setError('');
    setReviewing(true);
  };

  const closeReview = () => {
    if (busy) return;
    restoreApplyFocusRef.current = true;
    setReviewing(false);
  };

  const handleReviewKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeReview();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = reviewRef.current;
    if (!dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (
      document.activeElement === first || document.activeElement === reviewHeadingRef.current
    )) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section className="admin-mission-one" aria-labelledby="admin-mission-one-title">
      <header>
        <div>
          <p className="eyebrow">МИССИЯ 01 · OWNER</p>
          <h3 id="admin-mission-one-title">ЛИШНИЙ ПАССАЖИР</h3>
        </div>
        <time dateTime={`PT${Math.max(0, model.remainingSeconds)}S`}>
          {model.status === 'completed' ? 'ЗАВЕРШЕНО' : formatTimer(model.remainingSeconds)}
        </time>
      </header>

      <div className="admin-mission-one__progress">
        <strong>{completeCount} / {model.wagons.length} ГОТОВО</strong>
        <span>Решения фиксируются сервером. Статусы персонажей вручную не переключаются.</span>
      </div>

      <ul className="admin-mission-one__wagons" aria-label="Прогресс Миссии 01">
        {model.wagons.map((wagon) => (
          <li key={wagon.wagonId}>
            <div>
              <span>{wagon.status === 'completed' ? 'РЕШЕНИЕ ПРИНЯТО' : 'В РАБОТЕ'}</span>
              <strong>{wagon.label}</strong>
              <b>КВОТА · {wagon.quota}</b>
            </div>
            {wagon.status === 'completed' && onOverride && (
              <button type="button" disabled={busy} onClick={() => openOverride(wagon)}>
                ИЗМЕНИТЬ РЕШЕНИЕ · {wagon.label}
              </button>
            )}
          </li>
        ))}
      </ul>

      {draft && editedWagon && (
        <form
          className="admin-mission-one__override"
          aria-label={`Override · ${editedWagon.label}`}
          onSubmit={(event) => {
            event.preventDefault();
            requestReview();
          }}
        >
          <header>
            <div>
              <span>ПОДТВЕРЖДАЕМАЯ КОМАНДА</span>
              <h4>ИЗМЕНИТЬ РЕШЕНИЕ · {editedWagon.label}</h4>
            </div>
            <button type="button" disabled={busy} onClick={() => setDraft(null)}>ОТМЕНА</button>
          </header>
          <p>
            Будет заменён подтверждённый список из {editedWagon.quota} персонажей. Реальные гости останутся в игре.
          </p>
          <fieldset>
            <legend>Выберите ровно {editedWagon.quota} персонажей</legend>
            {editedWagon.members.map((member) => {
              const selected = draft.selectedGuestIds.includes(member.guestId);
              const quotaReached = draft.selectedGuestIds.length >= editedWagon.quota;
              return (
                <label key={member.guestId}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={busy || (!selected && quotaReached)}
                    onChange={() => toggle(member.guestId)}
                  />
                  <span><strong>{member.realName}</strong><small>{member.profession}</small></span>
                </label>
              );
            })}
          </fieldset>
          <label className="admin-mission-one__reason">
            <span>Причина изменения</span>
            <textarea
              value={draft.reason}
              disabled={busy}
              onChange={(event) => setDraft((current) => (
                current ? { ...current, reason: event.target.value } : current
              ))}
            />
          </label>
          <button
            ref={applyButtonRef}
            type="submit"
            className="admin-bunker-primary"
            disabled={
              busy
              || draft.selectedGuestIds.length !== editedWagon.quota
              || !draft.reason.trim()
            }
          >
            {busy ? 'ПРИМЕНЯЕМ…' : 'ПРИМЕНИТЬ OVERRIDE'}
          </button>
        </form>
      )}

      {reviewing && draft && editedWagon && createPortal(
        <div className="bunker-mission-one-player__modal-layer admin-mission-one__modal-layer">
          <div
            ref={reviewRef}
            className="bunker-mission-one-player__confirmation admin-mission-one__confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-mission-one-override-review-title"
            aria-describedby="admin-mission-one-override-review-effect"
            onKeyDown={handleReviewKeyDown}
          >
            <h3
              ref={reviewHeadingRef}
              id="admin-mission-one-override-review-title"
              tabIndex={-1}
            >
              Подтвердите изменение решения
            </h3>
            <p id="admin-mission-one-override-review-effect">
              Эти персонажи получат статус «ИСКЛЮЧЁН». Остальные персонажи вагона получат статус «СПАСЁН».
            </p>
            <ul>
              {selectedMembers.map((member) => <li key={member.guestId}>{member.realName}</li>)}
            </ul>
            <p><strong>Причина:</strong> {draft.reason.trim()}</p>
            {error && <p className="admin-bunker-error" role="alert">{error}</p>}
            <div>
              <button type="button" disabled={busy} onClick={closeReview}>ВЕРНУТЬСЯ К ПРОВЕРКЕ</button>
              <button
                type="button"
                className="admin-bunker-primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? 'ПРИМЕНЯЕМ…' : 'ПОДТВЕРДИТЬ OVERRIDE'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {error && !reviewing && <p className="admin-bunker-error" role="alert">{error}</p>}
    </section>
  );
}
