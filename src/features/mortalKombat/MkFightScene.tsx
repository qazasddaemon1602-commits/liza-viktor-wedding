import type { MkMatch, MkPlayer } from './mk.types';

type MkFightSceneProps = {
  match: MkMatch;
  players: MkPlayer[];
};

const roundLabels = {
  r16: '1/8 ФИНАЛА',
  qf: '1/4 ФИНАЛА',
  sf: '1/2 ФИНАЛА',
  final: 'ФИНАЛ',
} as const;

export function MkFightScene({ match, players }: MkFightSceneProps) {
  const names = new Map(players.map((player) => [player.guestId, player.displayName]));
  const player1 = match.player1GuestId ? names.get(match.player1GuestId) ?? 'ИГРОК 1' : '—';
  const player2 = match.player2GuestId ? names.get(match.player2GuestId) ?? 'ИГРОК 2' : '—';
  const winner = match.winnerGuestId ? names.get(match.winnerGuestId) ?? 'ИГРОК' : null;

  return (
    <section className="mk-screen-scene mk-fight-scene">
      <div className="mk-fight-topline">
        <span>ТЕКУЩИЙ БОЙ</span>
        <strong>{roundLabels[match.round]} · БОЙ {match.position}</strong>
      </div>

      <div className="mk-fight-versus">
        <div className={`mk-fighter${match.winnerGuestId === match.player1GuestId ? ' is-winner' : ''}`}>
          <span style={{ color: 'var(--mk-gold-dim)' }}>БОЕЦ 1</span>
          <h2>{player1}</h2>
        </div>
        <div className="mk-vs-mark">VS</div>
        <div className={`mk-fighter${match.winnerGuestId === match.player2GuestId ? ' is-winner' : ''}`}>
          <span style={{ color: 'var(--mk-gold-dim)' }}>БОЕЦ 2</span>
          <h2>{player2}</h2>
        </div>
      </div>

      {winner && (
        <div className="mk-fight-winner">
          <span>ПОБЕДИТЕЛЬ</span>
          <strong>{winner}</strong>
        </div>
      )}
    </section>
  );
}
