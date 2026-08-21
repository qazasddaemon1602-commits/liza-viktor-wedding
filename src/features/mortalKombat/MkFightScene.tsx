import { MK_ROUND_LABELS, type MkMatch, type MkPlayer } from './mk.types';

type MkFightSceneProps = {
  match: MkMatch;
  players: MkPlayer[];
};

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
      <picture className="mk-fight-art" aria-hidden="true">
        <source media="(max-width: 900px)" type="image/avif" srcSet="/images/tournament/arena-fight-mobile-720.avif 720w, /images/tournament/arena-fight-mobile-1086.avif 1086w" sizes="100vw" />
        <source media="(max-width: 900px)" type="image/webp" srcSet="/images/tournament/arena-fight-mobile-720.webp 720w, /images/tournament/arena-fight-mobile-1086.webp 1086w" sizes="100vw" />
        <source type="image/avif" srcSet="/images/tournament/arena-fight-wide-960.avif 960w, /images/tournament/arena-fight-wide-1672.avif 1672w" sizes="100vw" />
        <source type="image/webp" srcSet="/images/tournament/arena-fight-wide-960.webp 960w, /images/tournament/arena-fight-wide-1672.webp 1672w" sizes="100vw" />
        <img
          src="/images/tournament/arena-fight-wide.png"
          alt=""
          width="1672"
          height="941"
          data-testid="tournament-fight-art"
          decoding="async"
        />
      </picture>
      <div className="mk-fight-topline">
        <div className="mk-fight-topline__label">
          <span className="mk-fight-kicker">ARENA BOUT</span>
          <em>ТЕКУЩИЙ БОЙ</em>
        </div>
        <strong>{MK_ROUND_LABELS[match.round]} · BOUT {String(match.position).padStart(2, '0')}</strong>
      </div>

      <div className="mk-fight-versus">
        <article className={`mk-fighter${match.winnerGuestId === match.player1GuestId ? ' is-winner' : ''}`}>
          <span>FIGHTER 01</span>
          <small>БОЕЦ 1 · SEED {player1.seed}</small>
          <h2>{player1.name}</h2>
        </article>

        <div className="mk-vs-mark" aria-label="versus">VS</div>

        <article className={`mk-fighter mk-fighter--right${match.winnerGuestId === match.player2GuestId ? ' is-winner' : ''}`}>
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

