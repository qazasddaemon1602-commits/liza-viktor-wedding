import { useEffect, useState, type UIEvent } from 'react';
import { MK_ROUNDS, MK_ROUND_LABELS, type MkRound, type MkTournamentProjection } from './mk.types';

type ActiveProjection = Extract<MkTournamentProjection, { status: 'active' }>;

type PublicBracketProps = {
  state: ActiveProjection;
};

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
  const visibleRounds = MK_ROUNDS
    .filter((round) => realMatches.some((match) => match.round === round));
  const firstVisibleRound = visibleRounds[0] ?? null;
  const currentMatchRound = state.matches.find((match) => match.current)?.round ?? null;
  const authoritativeRound = currentMatchRound && visibleRounds.includes(currentMatchRound)
    ? currentMatchRound
    : null;
  const [selectedRound, setSelectedRound] = useState<MkRound | null>(
    authoritativeRound ?? firstVisibleRound,
  );
  const activeRound = selectedRound && visibleRounds.includes(selectedRound)
    ? selectedRound
    : authoritativeRound ?? firstVisibleRound;

  useEffect(() => {
    setSelectedRound(authoritativeRound ?? firstVisibleRound);
  }, [authoritativeRound, firstVisibleRound]);

  const selectRound = (round: MkRound) => {
    setSelectedRound(round);
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    document.getElementById(`mk-round-${round}`)?.scrollIntoView?.({
      behavior,
      block: 'nearest',
      inline: 'start',
    });
  };

  const synchronizeRoundFromScroll = (event: UIEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const viewportRect = viewport.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewportRect.width / 2;
    let nearestRound: MkRound | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    viewport.querySelectorAll<HTMLElement>('[data-round]').forEach((roundElement) => {
      const round = roundElement.dataset.round as MkRound | undefined;
      if (!round || !visibleRounds.includes(round)) return;
      const rect = roundElement.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - viewportCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestRound = round;
      }
    });

    if (nearestRound) setSelectedRound(nearestRound);
  };

  if (realMatches.length === 0) {
    return (
      <section className="mk-public-bracket mk-public-bracket--waiting">
        <p className="eyebrow">ARENA BOARD</p>
        <h2>ЖДЁМ ЖЕРЕБЬЁВКУ</h2>
        <p className="mk-bracket-live-label">LIVE BRACKET</p>
        <p>Игроков в основной сетке: {state.activeCount} / {state.maxPlayers}.</p>
      </section>
    );
  }


  return (
    <section className="mk-public-bracket">
      <div className="mk-section-heading">
        <div>
          <p className="eyebrow">ARENA BOARD</p>
          <span className="mk-bracket-russian">ТУРНИРНАЯ СЕТКА</span>
          <h2>АРЕНА · ПОСЛЕДНИЙ КРУГ</h2>
        </div>
        <div className="mk-bracket-status">
          <span>LIVE BRACKET</span>
          <strong>{state.state === 'complete' ? 'ARCHIVE' : 'LIVE'}</strong>
        </div>
      </div>

      <nav className="mk-round-navigation" aria-label="Этапы турнира">
        {visibleRounds.map((round) => (
          <button
            type="button"
            key={round}
            aria-controls={`mk-round-${round}`}
            aria-current={activeRound === round ? 'step' : undefined}
            onClick={() => selectRound(round)}
          >
            {MK_ROUND_LABELS[round]}
          </button>
        ))}
      </nav>

      <div
        className="mk-bracket-scroll"
        role="group"
        aria-label="Турнирные раунды"
        onScroll={synchronizeRoundFromScroll}
      >
        {visibleRounds.map((round, roundIndex) => (
          <section
            className="mk-bracket-round"
            id={`mk-round-${round}`}
            key={round}
            role="region"
            aria-labelledby={`mk-round-${round}-title`}
            data-active={activeRound === round ? 'true' : 'false'}
            data-round={round}
          >
            <div className="mk-bracket-round__heading">
              <span>0{roundIndex + 1}</span>
              <h3 id={`mk-round-${round}-title`}>{MK_ROUND_LABELS[round]}</h3>
            </div>
            {realMatches
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
          </section>
        ))}
      </div>
    </section>
  );
}

