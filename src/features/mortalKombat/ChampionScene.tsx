import { useEffect } from 'react';
import { siteAudio } from '../../lib/siteAudio';
import type { MkPlayer } from './mk.types';

type ChampionSceneProps = {
  championGuestId: string;
  players: MkPlayer[];
};

export function ChampionScene({ championGuestId, players }: ChampionSceneProps) {
  const champion = players.find((player) => player.guestId === championGuestId)?.displayName ?? 'ПОБЕДИТЕЛЬ';

  useEffect(() => {
    siteAudio.play('impact');
    const timer = window.setTimeout(() => siteAudio.play('success'), 240);
    return () => window.clearTimeout(timer);
  }, [championGuestId]);

  return (
    <section className="mk-screen-scene mk-champion-scene">
      <div className="mk-champion-index" aria-hidden="true">LAST BOUT · 15 / ARCHIVE 001</div>
      <p className="mk-champion-finish">FINISH HIM</p>
      <span>ПОБЕДИТЕЛЬ</span>
      <h2>{champion}</h2>
      <div className="mk-champion-rule" aria-hidden="true" />
      <i>30 · 08 · 2026 · FINAL VICTOR</i>
    </section>
  );
}
