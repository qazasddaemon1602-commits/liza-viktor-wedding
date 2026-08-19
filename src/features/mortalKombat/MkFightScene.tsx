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

function fighterMeta(player: MkPlayer | undefined, fallback: string) {
  return {
    name: player?.displayName ?? fallback,
    seed: player?.seed ? String(player.seed).padStart(2, '0') : '—',
  };
}

export function MkFightScene({ match, players }: MkFightSceneProps) {
  const playerById = new Map(players.map((player) => [player.guestId, player]));
  const player1 = fighterMeta(
    match.player1GuestId ? playerById.get(match.player1GuestId) : undefined,
    'ИГРОК 1',
  );
  const player2 = fighterMeta(
    match.player2GuestId ? playerById.get(match.player2GuestId) : undefined,
    'ИГРОК 2',
  );
  const winner = match.winnerGuestId
    ? playerById.get(match.winnerGuestId)?.displayName ?? 'ИГРОК'
    : null;

  return (
    <section className="mk-screen-scene mk-fight-scene">
      <div className="mk-fight-topline">
        <div className="mk-fight-topline__label">
          <span className="mk-fight-kicker">ARENA BOUT</span>
          <em>ТЕКУЩИЙ БОЙ</em>
        </div>
        <strong>{roundLabels[match.round]} · BOUT {String(match.position).padStart(2, '0')}</strong>
      </div>

      <div className="mk-fight-versus">
        <article className={`mk-fighter${match.winnerGuestId === match.player1GuestId ? ' is-winner' : ''}`}>
          <div className="mk-fighter-portrait mk-fighter-portrait--left" aria-hidden="true" />
          <span>FIGHTER 01</span>
          <small>БОЕЦ 1 · SEED {player1.seed}</small>
          <h2>{player1.name}</h2>
        </article>

        <div className="mk-vs-mark" aria-label="versus">VS</div>

        <article className={`mk-fighter mk-fighter--right${match.winnerGuestId === match.player2GuestId ? ' is-winner' : ''}`}>
          <div className="mk-fighter-portrait mk-fighter-portrait--right" aria-hidden="true" />
          <span>FIGHTER 02</span>
          <small>БОЕЦ 2 · SEED {player2.seed}</small>
          <h2>{player2.name}</h2>
        </article>
      </div>

      {winner && (
        <div className="mk-fight-winner">
          <span>FINAL RESULT</span>
          <strong>{winner}</strong>
        </div>
      )}
    </section>
  );
}
