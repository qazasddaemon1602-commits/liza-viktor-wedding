import type { MkTournamentProjection } from './mk.types';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

type PublicBracketProps = {
  state: ActiveProjection;
};

const roundLabels = {
  r16: '1/8 ФИНАЛА',
  qf: '1/4 ФИНАЛА',
  sf: '1/2 ФИНАЛА',
  final: 'ФИНАЛ',
} as const;

export function PublicBracket({ state }: PublicBracketProps) {
  const playerById = new Map(state.players.map((player) => [player.guestId, player]));
  const playerName = (guestId: string | null) => (
    guestId ? playerById.get(guestId)?.displayName ?? 'ИГРОК' : '—'
  );
  const playerSeed = (guestId: string | null) => {
    if (!guestId) return '—';
    const seed = playerById.get(guestId)?.seed;
    return seed ? String(seed).padStart(2, '0') : '—';
  };

  const realMatches = state.matches.filter(
    (match) => Boolean(match.player1GuestId) && Boolean(match.player2GuestId),
  );
  const visibleRounds = (['r16', 'qf', 'sf', 'final'] as const)
    .filter((round) => realMatches.some((match) => match.round === round));

  if (realMatches.length === 0) {
    return (
      <section className="mk-public-bracket mk-public-bracket--waiting">
        <p className="eyebrow">ARENA BOARD</p>
        <h2>ЖДЁМ ЖЕРЕБЬЁВКУ</h2>
        <p className="mk-bracket-live-label">LIVE BRACKET</p>
        <p>Игроков в основной сетке: {state.activeCount} / 16.</p>
      </section>
    );
  }


  return (
    <section className="mk-public-bracket">
      <div className="mk-section-heading">
        <div>
          <p className="eyebrow">ARENA BOARD</p>
          <span className="mk-bracket-russian">ТУРНИРНАЯ СЕТКА</span>
          <h2>MORTAL KOMBAT</h2>
        </div>
        <div className="mk-bracket-status">
          <span>LIVE BRACKET</span>
          <strong>{state.state === 'complete' ? 'ARCHIVE' : 'LIVE'}</strong>
        </div>
      </div>

      <div className="mk-bracket-scroll">
        {(['r16', 'qf', 'sf', 'final'] as const).map((round, roundIndex) => (
          <div className="mk-bracket-round" key={round}>
            <div className="mk-bracket-round__heading">
              <span>0{roundIndex + 1}</span>
              <h3>{roundLabels[round]}</h3>
            </div>
            {state.matches
              .filter((match) => match.round === round)
              .sort((a, b) => a.position - b.position)
              .map((match) => (
                <article
                  className={`mk-bracket-match${match.current ? ' mk-bracket-match--current' : ''}`}
                  key={match.id}
                >
                  <header>
                    <span>БОЙ {match.position}</span>
                    {match.current && <em>CURRENT BOUT</em>}
                  </header>
                  <div className="mk-bracket-fighter">
                    <b>{playerSeed(match.player1GuestId)}</b>
                    <strong className={match.winnerGuestId === match.player1GuestId ? 'is-winner' : ''}>
                      {playerName(match.player1GuestId)}
                    </strong>
                  </div>
                  <i aria-hidden="true">VS</i>
                  <div className="mk-bracket-fighter">
                    <b>{playerSeed(match.player2GuestId)}</b>
                    <strong className={match.winnerGuestId === match.player2GuestId ? 'is-winner' : ''}>
                      {playerName(match.player2GuestId)}
                    </strong>
                  </div>
                </article>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
