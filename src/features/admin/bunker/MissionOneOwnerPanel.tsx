import { useState } from 'react';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const completeCount = model.wagons.filter((wagon) => wagon.status === 'completed').length;
  const editedWagon = draft
    ? model.wagons.find((wagon) => wagon.wagonId === draft.wagonId) ?? null
    : null;

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
      setDraft(null);
    } catch {
      setError('Override не применён. Перечитайте прогресс перед повтором.');
    } finally {
      setBusy(false);
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
            void submit();
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

      {error && <p className="admin-bunker-error" role="alert">{error}</p>}
    </section>
  );
}
