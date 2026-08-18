import type { MkOwnerRegistration } from '../../mortalKombat/mk.types';

type PlayerPoolEditorProps = {
  registrations: MkOwnerRegistration[];
  disabled?: boolean;
  onSwap: (registrationA: string, registrationB: string) => Promise<void>;
  onRemove: (registrationId: string) => Promise<void>;
};

export function PlayerPoolEditor({
  registrations,
  disabled = false,
  onSwap,
  onRemove,
}: PlayerPoolEditorProps) {
  const seeded = registrations
    .filter((registration) => registration.status === 'active')
    .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

  return (
    <div className="mk-seed-editor" aria-label="Позиции игроков в сетке">
      {seeded.map((registration) => (
        <article className="mk-seed-slot" data-testid="seed-slot" key={registration.registrationId}>
          <span className="mk-seed-number">#{registration.seed ?? '—'}</span>
          <strong>{registration.displayName}</strong>
          <label>
            <span>Поменять с</span>
            <select
              aria-label={`Поменять позицию ${registration.displayName}`}
              value=""
              disabled={disabled || registration.seed === null}
              onChange={(event) => {
                const target = event.target.value;
                event.currentTarget.value = '';
                if (target) void onSwap(registration.registrationId, target);
              }}
            >
              <option value="">—</option>
              {seeded
                .filter((candidate) => candidate.registrationId !== registration.registrationId)
                .map((candidate) => (
                  <option value={candidate.registrationId} key={candidate.registrationId}>
                    #{candidate.seed ?? '—'} · {candidate.displayName}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="mk-seed-remove"
            aria-label={`УБРАТЬ ИЗ СЕТКИ · ${registration.displayName}`}
            disabled={disabled}
            onClick={() => void onRemove(registration.registrationId)}
          >
            НЕ ПРИШЁЛ · УБРАТЬ
          </button>
        </article>
      ))}
    </div>
  );
}
