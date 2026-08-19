import type { MkPlayer } from './mk.types';

type ChampionSceneProps = {
  championGuestId: string;
  players: MkPlayer[];
};

export function ChampionScene({ championGuestId, players }: ChampionSceneProps) {
  const champion = players.find((player) => player.guestId === championGuestId)?.displayName ?? 'ПОБЕДИТЕЛЬ';

  return (
    <section className="mk-screen-scene mk-champion-scene">
      <p style={{ color: 'var(--mk-red)', textShadow: '0 0 30px rgba(142,27,27,0.8)', fontSize: 'clamp(4rem, 12vw, 15rem)', fontStyle: 'normal' }}>
        FINISH HIM
      </p>
      <span style={{ letterSpacing: '0.5em', marginTop: '1rem' }}>ПОБЕДИТЕЛЬ</span>
      <h2 style={{ fontSize: 'clamp(6rem, 18vw, 22rem)' }}>{champion}</h2>
      <i aria-hidden="true" style={{ color: 'var(--mk-gold-dim)' }}>30 · 08 · 2026</i>
    </section>
  );
}
