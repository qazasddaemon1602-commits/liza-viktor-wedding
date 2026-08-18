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
  const playerName = new Map(state.players.map((player) => [player.guestId, player.displayName]));

  if (state.matches.length === 0) {
    return (
      <section className="mk-public-bracket mk-public-bracket--waiting">
        <p className="eyebrow">СЕТКА</p>
        <h2>ЖДЁМ ЖЕРЕБЬЁВКУ</h2>
        <p>Игроков в основной сетке: {state.activeCount} / 16.</p>
      </section>
    );
  }

  return (
    <section className="mk-public-bracket">
      <div className="mk-section-heading">
        <div>
          <p className="eyebrow">ТУРНИРНАЯ СЕТКА</p>
          <h2>MORTAL KOMBAT</h2>
        </div>
        <span>{state.state === 'complete' ? 'ЗАВЕРШЁН' : 'LIVE'}</span>
      </div>

      <div className="mk-bracket-scroll">
        {(['r16', 'qf', 'sf', 'final'] as const).map((round) => (
          <div className="mk-bracket-round" key={round}>
            <h3>{roundLabels[round]}</h3>
            {state.matches
              .filter((match) => match.round === round)
              .sort((a, b) => a.position - b.position)
              .map((match) => (
                <article
                  className={`mk-bracket-match${match.current ? ' mk-bracket-match--current' : ''}`}
                  key={match.id}
                >
                  <span>БОЙ {match.position}</span>
                  <strong className={match.winnerGuestId === match.player1GuestId ? 'is-winner' : ''}>
                    {match.player1GuestId ? playerName.get(match.player1GuestId) ?? 'ИГРОК' : '—'}
                  </strong>
                  <i aria-hidden="true">×</i>
                  <strong className={match.winnerGuestId === match.player2GuestId ? 'is-winner' : ''}>
                    {match.player2GuestId ? playerName.get(match.player2GuestId) ?? 'ИГРОК' : '—'}
                  </strong>
                </article>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
