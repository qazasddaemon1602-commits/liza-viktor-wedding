import { useEffect, useState } from 'react';
import { siteAudio } from '../../../lib/siteAudio';

const REVEAL_COPY = 'Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза';
const REVEAL_AUDIO_DELAY_MS = 1_600;
const REVEAL_AUDIO_STORAGE_PREFIX = 'bunker.liza-reveal.phase.v2:';
const replayMemory = new Set<string>();

type RevealAudio = {
  playDoor: () => void;
  playReveal: () => void;
};

type Props = {
  sessionKey?: string;
  soundEnabled?: boolean;
  audio?: RevealAudio;
};

type ReplayPhase = 'door' | 'reveal-complete';

function replayKey(sessionKey: string, phase: ReplayPhase): string {
  return `${REVEAL_AUDIO_STORAGE_PREFIX}${encodeURIComponent(sessionKey)}:${phase}`;
}

function hasPlayed(sessionKey: string, phase: ReplayPhase): boolean {
  const key = replayKey(sessionKey, phase);
  if (replayMemory.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markPlayed(sessionKey: string, phase: ReplayPhase): void {
  const key = replayKey(sessionKey, phase);
  replayMemory.add(key);
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // The in-memory phase marker keeps this page lifecycle replay-safe.
  }
}

export function LizaRevealScreen({ sessionKey, soundEnabled = false, audio }: Props = {}) {
  const [imageAvailable, setImageAvailable] = useState(true);
  const [localSoundEnabled, setLocalSoundEnabled] = useState(() => (
    siteAudio.isEnabled() && siteAudio.getVolume() > 0
  ));

  useEffect(() => siteAudio.subscribe((settings) => {
    setLocalSoundEnabled(settings.enabled && settings.volume > 0);
  }), []);

  const effectiveSoundEnabled = soundEnabled && localSoundEnabled;

  useEffect(() => {
    if (!sessionKey || !effectiveSoundEnabled || !audio || hasPlayed(sessionKey, 'reveal-complete')) {
      return undefined;
    }
    if (!hasPlayed(sessionKey, 'door')) {
      markPlayed(sessionKey, 'door');
      audio.playDoor();
    }
    const timer = window.setTimeout(() => {
      if (hasPlayed(sessionKey, 'reveal-complete')) return;
      markPlayed(sessionKey, 'reveal-complete');
      audio.playReveal();
    }, REVEAL_AUDIO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [audio, effectiveSoundEnabled, sessionKey]);

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
