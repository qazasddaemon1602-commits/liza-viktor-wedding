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
      <picture className="mk-champion-art" aria-hidden="true">
        <source type="image/avif" srcSet="/images/tournament/champion-hall-960.avif 960w, /images/tournament/champion-hall-1672.avif 1672w" sizes="100vw" />
        <source type="image/webp" srcSet="/images/tournament/champion-hall-960.webp 960w, /images/tournament/champion-hall-1672.webp 1672w" sizes="100vw" />
        <img
          src="/images/tournament/champion-hall.png"
          alt=""
          width="1672"
          height="941"
          data-testid="tournament-champion-art"
          decoding="async"
        />
      </picture>
      <div className="mk-champion-index" aria-hidden="true">LAST BOUT · 15 / ARCHIVE 001</div>
      <p className="mk-champion-finish">ПОСЛЕДНИЙ БОЙ ЗАВЕРШЁН</p>
      <span>ПОБЕДИТЕЛЬ</span>
      <h2>{champion}</h2>
      <i>30 · 08 · 2026 · FINAL VICTOR</i>
    </section>
  );
}

