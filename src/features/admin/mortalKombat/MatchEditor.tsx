import { useState } from 'react';
import type { MkResultResponse } from '../../mortalKombat/mk.owner.service';
import type { MkMatch, MkOwnerRegistration } from '../../mortalKombat/mk.types';
import { CorrectionImpactDialog } from './CorrectionImpactDialog';

type MatchEditorProps = {
  matches: MkMatch[];
  registrations: MkOwnerRegistration[];
  onSetCurrent: (matchId: string) => Promise<void>;
  onRecordWinner: (matchId: string, winnerGuestId: string, clearDownstream: boolean) => Promise<MkResultResponse>;
  onUndo: (matchId: string, clearDownstream: boolean) => Promise<MkResultResponse>;
  onChanged: () => Promise<void>;
};

type PendingCorrection =
  | { kind: 'winner'; matchId: string; winnerGuestId: string; impact: Extract<MkResultResponse, { status: 'impact' }> }
  | { kind: 'undo'; matchId: string; impact: Extract<MkResultResponse, { status: 'impact' }> };

const roundLabels = {
  r16: '1/8 ФИНАЛА',
  qf: '1/4 ФИНАЛА',
  sf: '1/2 ФИНАЛА',
  final: 'ФИНАЛ',
} as const;

export function MatchEditor({
  matches,
  registrations,
  onSetCurrent,
  onRecordWinner,
  onUndo,
  onChanged,
}: MatchEditorProps) {
  const [busy, setBusy] = useState(false);
  const [correction, setCorrection] = useState<PendingCorrection | null>(null);
  const [error, setError] = useState('');
  const names = new Map(registrations.map((registration) => [registration.guestId, registration.displayName]));
  const realMatches = matches.filter(
    (match) => Boolean(match.player1GuestId) && Boolean(match.player2GuestId),
  );
  const current = realMatches.find((match) => match.current)
    ?? realMatches.find((match) => match.status === 'ready')
    ?? null;

  const mutate = async (action: () => Promise<MkResultResponse>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (result.status !== 'impact') await onChanged();
      return result;
    } catch {
      setError('Не удалось изменить результат боя. Сетка оставлена без изменений.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const record = async (matchId: string, winnerGuestId: string) => {
    const result = await mutate(() => onRecordWinner(matchId, winnerGuestId, false));
    if (result?.status === 'impact') {
      setCorrection({ kind: 'winner', matchId, winnerGuestId, impact: result });
    }
  };

  const undo = async (matchId: string) => {
    const result = await mutate(() => onUndo(matchId, false));
    if (result?.status === 'impact') {
      setCorrection({ kind: 'undo', matchId, impact: result });
    }
  };

  const confirmCorrection = async () => {
    if (!correction || busy) return;
    setBusy(true);
    setError('');
    try {
      if (correction.kind === 'winner') {
        await onRecordWinner(correction.matchId, correction.winnerGuestId, true);
      } else {
        await onUndo(correction.matchId, true);
      }
      setCorrection(null);
      await onChanged();
    } catch {
      setError('Исправление не выполнено. Сетка оставлена как была.');
    } finally {
      setBusy(false);
    }
  };

  if (realMatches.length === 0) return null;

  return (
    <div className="admin-mk-matches">
      {current && (
        <section className="admin-mk-current-match">
          <p className="eyebrow">ТЕКУЩИЙ БОЙ · {roundLabels[current.round]}</p>
          <h3>
            {current.player1GuestId ? names.get(current.player1GuestId) ?? 'ИГРОК 1' : '—'}
            <span aria-hidden="true"> × </span>
            {current.player2GuestId ? names.get(current.player2GuestId) ?? 'ИГРОК 2' : '—'}
          </h3>

          {current.status !== 'complete' && current.player1GuestId && current.player2GuestId && (
            <div className="admin-mk-winner-buttons">
              <button
                type="button"
                disabled={busy}
                onClick={() => void record(current.id, current.player1GuestId!)}
              >
                ПОБЕДИЛ · {names.get(current.player1GuestId) ?? 'ИГРОК 1'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void record(current.id, current.player2GuestId!)}
              >
                ПОБЕДИЛ · {names.get(current.player2GuestId) ?? 'ИГРОК 2'}
              </button>
            </div>
          )}

          {current.status === 'complete' && (
            <div className="admin-mk-result-summary">
              <strong>ПОБЕДИТЕЛЬ · {current.winnerGuestId ? names.get(current.winnerGuestId) ?? 'ИГРОК' : '—'}</strong>
              <button type="button" className="registration-secondary" disabled={busy} onClick={() => void undo(current.id)}>
                ОТМЕНИТЬ РЕЗУЛЬТАТ
              </button>
            </div>
          )}
        </section>
      )}

      <div className="admin-mk-match-list">
        {realMatches.map((match) => (
          <article key={match.id} className={match.current ? 'is-current' : ''}>
            <span>{roundLabels[match.round]} · БОЙ {match.position}</span>
            <strong>
              {match.player1GuestId ? names.get(match.player1GuestId) ?? '—' : '—'} ×{' '}
              {match.player2GuestId ? names.get(match.player2GuestId) ?? '—' : '—'}
            </strong>
            <em>{match.status === 'complete' ? 'ЗАВЕРШЁН' : match.status === 'ready' ? 'ГОТОВ' : 'ЖДЁТ'}</em>
            {match.status === 'ready' && !match.current && (
              <button
                type="button"
                className="registration-secondary"
                disabled={busy}
                onClick={() => void (async () => {
                  setBusy(true);
                  try {
                    await onSetCurrent(match.id);
                    await onChanged();
                  } finally {
                    setBusy(false);
                  }
                })()}
              >
                ВЫВЕСТИ БОЙ
              </button>
            )}
            {match.status === 'complete' && match.id !== current?.id && (
              <button type="button" className="registration-secondary" disabled={busy} onClick={() => void undo(match.id)}>
                ИСПРАВИТЬ
              </button>
            )}
          </article>
        ))}
      </div>

      {error && <p className="admin-mk-error" role="alert">{error}</p>}

      {correction && (
        <CorrectionImpactDialog
          affected={correction.impact.affectedMatches}
          onCancel={() => setCorrection(null)}
          onConfirm={() => void confirmCorrection()}
        />
      )}
    </div>
  );
}
