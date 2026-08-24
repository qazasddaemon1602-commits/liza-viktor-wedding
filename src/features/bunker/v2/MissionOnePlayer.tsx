import { useEffect, useMemo, useRef, useState } from 'react';

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
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([...model.selectedGuestIds]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const outcomeStatusRef = useRef<HTMLDivElement>(null);
  const submittedStatusRef = useRef<HTMLParagraphElement>(null);
  const resultFocusRequestedRef = useRef(false);
  const authoritativeSelectionKey = model.selectedGuestIds.join('\u001f');

  useEffect(() => {
    setSelectedGuestIds([...model.selectedGuestIds]);
    setSubmitting(false);
    setSubmitted(false);
    setError('');
  }, [model.instanceId, model.instanceVersion, authoritativeSelectionKey]);

  useEffect(() => {
    const resultStatus = outcomeStatusRef.current ?? submittedStatusRef.current;
    if (resultFocusRequestedRef.current && resultStatus) {
      resultFocusRequestedRef.current = false;
      resultStatus.focus();
    }
  }, [model.status, submitted]);

  const selectedMembers = useMemo(() => {
    const selected = new Set(model.status === 'completed' ? model.selectedGuestIds : selectedGuestIds);
    return model.members.filter((member) => selected.has(member.guestId));
  }, [model.members, model.selectedGuestIds, model.status, selectedGuestIds]);
  const selectionComplete = selectedGuestIds.length === model.quota;
  const unavailable = model.connection === 'reconnecting' || !onConfirm;

  const toggle = (guestId: string) => {
    setError('');
    setSelectedGuestIds((current) => (
      current.includes(guestId)
        ? current.filter((id) => id !== guestId)
        : current.length < model.quota ? [...current, guestId] : current
    ));
  };

  const submit = async () => {
    if (!onConfirm || !selectionComplete || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm([...selectedGuestIds]);
      resultFocusRequestedRef.current = true;
      setSubmitted(true);
    } catch {
      setError('Решение не отправлено. Сначала обновите состояние задания, затем решите, нужен ли повтор.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bunker-mission-one-player" aria-label="Миссия 01 · Лишний пассажир" data-reference-viewport="390x844">
      <header className="bunker-mission-one-player__header">
        <div><p>МИССИЯ 01 · {model.wagon.label}</p><h2>Лишний пассажир</h2></div>
        <time dateTime={`PT${Math.max(0, model.remainingSeconds)}S`} aria-label="До завершения задания">{formatTimer(model.remainingSeconds)}</time>
      </header>
      <p className="bunker-mission-one-player__question">Решите, каких {quotaAccusative(model.quota)} сюжетных персонажей вагон не возьмёт дальше.</p>
      <p className="bunker-mission-one-player__continuity">Вы выбираете судьбу персонажей. Все реальные гости остаются в игре и продолжают пользоваться сайтом.</p>
      <details className="bunker-mission-one-player__briefing">
        <summary>Сводка резервного вагона</summary>
        <p>Резервный вагон временно держит двери закрытыми, пока каждый состав сверяет пассажирский протокол.</p>
        <p>Сравните карточки персонажей и выберите ровно столько имён, сколько просит система.</p>
      </details>

      {model.status === 'completed' ? (
        <div ref={outcomeStatusRef} className="bunker-mission-one-player__outcome" role="status" tabIndex={-1}>
          <strong>РЕШЕНИЕ ПРИНЯТО</strong>
          <p>Сюжетные персонажи, которых не берёт вагон:</p>
          <ul>{selectedMembers.map((member) => <li key={member.guestId}>{member.realName}</li>)}</ul>
          <small>Гости остаются участниками свадьбы и следующих заданий.</small>
        </div>
      ) : submitted ? (
        <p ref={submittedStatusRef} className="bunker-mission-one-player__sync" role="status" tabIndex={-1}>Решение отправлено. Получаем подтверждённый итог с сервера…</p>
      ) : (
        <>
          {model.connection === 'reconnecting' && <p className="bunker-mission-one-player__sync" role="status">Восстанавливаем связь. Сохраняем выбранные карточки и ждём серверный итог.</p>}
          <div className="bunker-mission-one-player__quota" aria-live="polite"><strong>ВЫБРАНО · {selectedGuestIds.length} / {model.quota}</strong><span>Нужно выбрать ровно {model.quota}</span></div>
          {selectedMembers.length > 0 && <p className="bunker-mission-one-player__decision" role="status" aria-label="Выбор вагона">Выбрано: {selectedMembers.map((member) => member.realName).join(' · ')}</p>}
          <fieldset className="bunker-mission-one-player__members">
            <legend>Выберите ровно {model.quota} сюжетных персонажей</legend>
            {model.members.map((member) => {
              const selected = selectedGuestIds.includes(member.guestId);
              const quotaReached = selectedGuestIds.length >= model.quota;
              return <label key={member.guestId} className={selected ? 'is-selected' : ''}>
                <input type="checkbox" checked={selected} disabled={unavailable || (!selected && quotaReached)} onChange={() => toggle(member.guestId)} />
                <span><strong>{member.realName}</strong><b>{member.profession}</b><small>{member.health} · {member.visibleSkill}</small></span>
              </label>;
            })}
          </fieldset>
          <button type="button" className="bunker-mission-one-player__primary" disabled={!selectionComplete || unavailable || submitting} onClick={() => void submit()}>{submitting ? 'Подтверждаем…' : 'Подтвердить решение'}</button>
          {error && <p className="bunker-mission-one-player__error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
