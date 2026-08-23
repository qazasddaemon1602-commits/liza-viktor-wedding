import { useState } from 'react';

const REVEAL_COPY = 'Сигнал принят. Поезд Виктора прибыл. Я ждала вас. — Лиза';

export function LizaRevealPlayer() {
  const [imageAvailable, setImageAvailable] = useState(true);

  return (
    <section
      className="bunker-v2-mission bunker-liza-reveal bunker-liza-reveal--player"
      aria-label="Лиза встречает поезд"
      aria-live="polite"
    >
      <header>
        <span>КАНАЛ BK-17 РАСКРЫТ</span>
        <h1>ЛИЗА</h1>
      </header>
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
      <blockquote aria-label={REVEAL_COPY}>
        <span>Сигнал принят. </span>
        <span>Поезд Виктора прибыл. </span>
        <span>Я ждала вас. </span>
        <strong>— Лиза</strong>
      </blockquote>
      <p>Смотрите на общий экран. Поезд прибыл к конечной станции.</p>
    </section>
  );
}
