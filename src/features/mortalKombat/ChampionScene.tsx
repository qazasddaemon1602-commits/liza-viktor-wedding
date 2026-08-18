import type { MkPlayer } from './mk.types';

type ChampionSceneProps = {
  championGuestId: string;
  players: MkPlayer[];
};

export function ChampionScene({ championGuestId, players }: ChampionSceneProps) {
  const champion = players.find((player) => player.guestId === championGuestId)?.displayName ?? 'ПОБЕДИТЕЛЬ';

  return (
    <section className="mk-screen-scene mk-champion-scene">
      <p>FINISH HIM</p>
      <span>CHAMPION</span>
      <h2>{champion}</h2>
      <i aria-hidden="true">30 · 08 · 2026</i>
    </section>
  );
}
