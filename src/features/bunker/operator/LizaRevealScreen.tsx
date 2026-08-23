import { useEffect, useState } from 'react';

const REVEAL_COPY = 'Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза';
const REVEAL_AUDIO_DELAY_MS = 1_600;
const REVEAL_AUDIO_STORAGE_PREFIX = 'bunker.liza-reveal.played.v1:';

type RevealAudio = {
  playDoor: () => void;
  playReveal: () => void;
};

type Props = {
  sessionKey?: string;
  soundEnabled?: boolean;
  audio?: RevealAudio;
};

function replayKey(sessionKey: string): string {
  return `${REVEAL_AUDIO_STORAGE_PREFIX}${encodeURIComponent(sessionKey)}`;
}

function hasPlayed(sessionKey: string): boolean {
  try {
    return window.sessionStorage.getItem(replayKey(sessionKey)) === '1';
  } catch {
    return false;
  }
}

function markPlayed(sessionKey: string): void {
  try {
    window.sessionStorage.setItem(replayKey(sessionKey), '1');
  } catch {
    // Replay protection remains best-effort when browser storage is unavailable.
  }
}

export function LizaRevealScreen({ sessionKey, soundEnabled = false, audio }: Props = {}) {
  const [imageAvailable, setImageAvailable] = useState(true);

  useEffect(() => {
    if (!sessionKey || !soundEnabled || !audio || hasPlayed(sessionKey)) return undefined;
    markPlayed(sessionKey);
    audio.playDoor();
    const timer = window.setTimeout(audio.playReveal, REVEAL_AUDIO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [audio, sessionKey, soundEnabled]);

  return (
    <section
      className="bunker-v2-screen bunker-liza-reveal bunker-liza-reveal--screen"
      aria-label="Лиза встречает поезд · общий экран"
      aria-live="polite"
    >
      <div className="bunker-liza-reveal__signal" aria-hidden="true">
        <span />
        <strong>BK-17 · КАНАЛ ОТКРЫТ</strong>
      </div>
      <div className="bunker-liza-reveal__layout">
        {imageAvailable && (
          <picture className="bunker-liza-reveal__portrait">
            <source srcSet="/images/bunker/story/liza-reveal.avif" type="image/avif" />
            <img
              src="/images/bunker/story/liza-reveal.webp"
              alt="Лиза встречает прибывший поезд у открытого Бункера"
              onError={() => setImageAvailable(false)}
            />
          </picture>
        )}
        <div className="bunker-liza-reveal__copy">
          <p>КОНЕЧНАЯ СТАНЦИЯ · BK-17</p>
          <h1>ЛИЗА</h1>
          <blockquote aria-label={REVEAL_COPY}>
            <span>Сигнал принят. </span>
            <span>Поезд Виктора прибыл. </span>
            <span>Я ждала вас. </span>
            <strong>— Лиза</strong>
          </blockquote>
        </div>
      </div>
      <footer>ВОРОТА ОТКРЫТЫ · МАРШРУТ ЗАВЕРШЁН</footer>
    </section>
  );
}
