import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MissionBriefing } from './MissionBriefing';
import { bunkerMissionContent } from './missionContent';


export type MissionOnePlayerMember = {
  guestId: string;
  realName: string;
  profession: string;
  health: string;
  visibleSkill: string;
};

export type MissionOnePlayerReadModel = {
  instanceId: string;
  instanceVersion: number;
  status: 'active' | 'completed';
  wagon: { number: number; label: string };
  quota: number;
  remainingSeconds: number;
  connection: 'online' | 'reconnecting';
  members: readonly MissionOnePlayerMember[];
  selectedGuestIds: readonly string[];
};

type MissionOnePlayerProps = {
  model: MissionOnePlayerReadModel;
  onConfirm?: (selectedGuestIds: string[]) => Promise<void> | void;
};

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function quotaAccusative(quota: number): string {
  if (quota === 1) return 'одного';
  if (quota === 2) return 'двух';
  if (quota === 3) return 'трёх';
  return String(quota);
}

export function MissionOnePlayer({ model, onConfirm }: MissionOnePlayerProps) {
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([
    ...model.selectedGuestIds,
  ]);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const confirmationRef = useRef<HTMLDivElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectionButtonRef = useRef<HTMLButtonElement>(null);
  const outcomeStatusRef = useRef<HTMLDivElement>(null);
  const submittedStatusRef = useRef<HTMLParagraphElement>(null);
  const restoreSelectionFocusRef = useRef(false);
  const resultFocusRequestedRef = useRef(false);
  const authoritativeSelectionKey = model.selectedGuestIds.join('\u001f');

  useEffect(() => {
    setSelectedGuestIds([...model.selectedGuestIds]);
    setReviewing(false);
    setSubmitting(false);
    setSubmitted(false);
    setError('');
  }, [model.instanceId, model.instanceVersion, authoritativeSelectionKey]);

  useEffect(() => {
    if (!reviewing) return undefined;
    confirmationHeadingRef.current?.focus();
    const dialog = confirmationRef.current;
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
    if (!reviewing && restoreSelectionFocusRef.current) {
      restoreSelectionFocusRef.current = false;
      selectionButtonRef.current?.focus();
    }
  }, [reviewing]);

  useEffect(() => {
    const resultStatus = outcomeStatusRef.current ?? submittedStatusRef.current;
    if (!reviewing && resultFocusRequestedRef.current && resultStatus) {
      resultFocusRequestedRef.current = false;
      resultStatus.focus();
    }
  }, [model.status, reviewing, submitted]);

  const selectedMembers = useMemo(() => {
    const selected = new Set(model.selectedGuestIds);
    return model.members.filter((member) => selected.has(member.guestId));
  }, [model.members, model.selectedGuestIds]);

  const draftMembers = useMemo(() => {
    const selected = new Set(selectedGuestIds);
    return model.members.filter((member) => selected.has(member.guestId));
  }, [model.members, selectedGuestIds]);

  const selectionComplete = selectedGuestIds.length === model.quota;
  const unavailable = model.connection === 'reconnecting' || !onConfirm;

  const toggle = (guestId: string) => {
    setError('');
    setSelectedGuestIds((current) => (
      current.includes(guestId)
        ? current.filter((id) => id !== guestId)
        : current.length < model.quota
          ? [...current, guestId]
          : current
    ));
  };

  const closeReview = () => {
    if (submitting) return;
    restoreSelectionFocusRef.current = true;
    setReviewing(false);
  };

  const handleConfirmationKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeReview();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = confirmationRef.current;
    if (!dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )];
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === confirmationHeadingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = async () => {
    if (!onConfirm || !selectionComplete || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm([...selectedGuestIds]);
      resultFocusRequestedRef.current = true;
      setReviewing(false);
      setSubmitted(true);
    } catch {
      setError('Ответ не подтверждён. Сначала обновите состояние задания, затем решите, нужен ли повтор.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="bunker-mission-one-player"
      aria-label="Миссия 01 · Лишний пассажир"
      data-reference-viewport="390x844"
    >
      <header className="bunker-mission-one-player__header">
        <div>
          <p>МИССИЯ 01 · {model.wagon.label}</p>
          <h2>Лишний пассажир</h2>
        </div>
        <time dateTime={`PT${Math.max(0, model.remainingSeconds)}S`} aria-label="До завершения задания">
          {formatTimer(model.remainingSeconds)}
        </time>
      </header>

      <p className="bunker-mission-one-player__question">
        Решите, каких {quotaAccusative(model.quota)} сюжетных персонажей вагон не возьмёт дальше.
      </p>
      <p className="bunker-mission-one-player__continuity">
        Вы выбираете судьбу персонажей. Все реальные гости остаются в игре и продолжают пользоваться сайтом.
      </p>

      {missionContent && <MissionBriefing content={missionContent} />}

      {model.status === 'completed' ? (

        <div
          ref={outcomeStatusRef}
          className="bunker-mission-one-player__outcome"
          role="status"
          tabIndex={-1}
        >
          <strong>РЕШЕНИЕ ПРИНЯТО</strong>
          <p>Сюжетные персонажи, которых не берёт вагон:</p>
          <ul>
            {selectedMembers.map((member) => <li key={member.guestId}>{member.realName}</li>)}
          </ul>
          <small>Гости остаются участниками свадьбы и следующих заданий.</small>
        </div>
      ) : submitted ? (
        <p
          ref={submittedStatusRef}
          className="bunker-mission-one-player__sync"
          role="status"
          tabIndex={-1}
        >
          Решение отправлено. Получаем подтверждённый итог с сервера…
        </p>
      ) : reviewing ? createPortal(
        <div className="bunker-mission-one-player__modal-layer">
          <div
            ref={confirmationRef}
            className="bunker-mission-one-player__confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mission-one-confirmation-title"
            onKeyDown={handleConfirmationKeyDown}
          >
            <h3
              ref={confirmationHeadingRef}
              id="mission-one-confirmation-title"
              tabIndex={-1}
            >
              Проверьте решение вагона
            </h3>
            <p>После подтверждения изменить список сможет только ведущий с указанием причины.</p>
            <ul>
              {draftMembers.map((member) => <li key={member.guestId}>{member.realName}</li>)}
            </ul>
            {error && (
              <p className="bunker-mission-one-player__error" role="alert" aria-live="assertive">
                {error}
              </p>
            )}
            <div>
              <button
                type="button"
                className="bunker-mission-one-player__secondary"
                disabled={submitting}
                onClick={closeReview}
              >
                Вернуться к выбору
              </button>
              <button
                type="button"
                className="bunker-mission-one-player__primary"
                disabled={submitting}
                onClick={() => void submit()}
              >
                {submitting ? 'Подтверждаем…' : 'Подтвердить решение'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : (
        <>
          {model.connection === 'reconnecting' && (
            <p className="bunker-mission-one-player__sync" role="status">
              Восстанавливаем связь. Сохраняем выбранные карточки и ждём серверный итог.
            </p>
          )}

          <div className="bunker-mission-one-player__quota" aria-live="polite">
            <strong>ВЫБРАНО · {selectedGuestIds.length} / {model.quota}</strong>
            <span>Нужно выбрать ровно {model.quota}</span>
          </div>

          <fieldset className="bunker-mission-one-player__members">
            <legend>Выберите ровно {model.quota} сюжетных персонажей</legend>
            {model.members.map((member) => {
              const selected = selectedGuestIds.includes(member.guestId);
              const quotaReached = selectedGuestIds.length >= model.quota;
              return (
                <label key={member.guestId} className={selected ? 'is-selected' : ''}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={unavailable || (!selected && quotaReached)}
                    onChange={() => toggle(member.guestId)}
                  />
                  <span>
                    <strong>{member.realName}</strong>
                    <b>{member.profession}</b>
                    <small>{member.health} · {member.visibleSkill}</small>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <button
            ref={selectionButtonRef}
            type="button"
            className="bunker-mission-one-player__primary"
            disabled={!selectionComplete || unavailable}
            onClick={() => setReviewing(true)}
          >
            Подтвердить решение
          </button>
        </>
      )}

      {error && !reviewing && (
        <p className="bunker-mission-one-player__error" role="alert">{error}</p>
      )}
    </section>
  );
}
