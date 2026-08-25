export type FinalScreenModel = {
  remainingSeconds: number;
  solved: number;
  total: number;
  wrongAttempts: number;
  unlocked: boolean;
  hintLevel: number;
  timeAdjustmentSeconds?: number;
};

function timer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function FinalScreen({ model }: { model: FinalScreenModel }) {
  return (
    <section className={`bunker-v2-screen bunker-v2-final-screen${model.unlocked ? ' is-unlocked' : ''}`} aria-label="Финал · общий экран">
      <header>
        <div>
          <p>ЭКСТРЕННОЕ СООБЩЕНИЕ</p>
          <h1>{model.unlocked ? 'ДОСТУП ПОЛУЧЕН' : 'ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА — БУНКЕР'}</h1>
        </div>
        <time aria-label="До прибытия">{timer(model.remainingSeconds)}</time>
      </header>
      <main className="bunker-v2-final-screen__content">
        <section className="bunker-v2-final-screen__status" aria-label="Ход финальной проверки">
          {model.unlocked ? (
            <><strong>ШЛЮЗ РАЗБЛОКИРОВАН</strong><p>ПРИГОТОВЬТЕСЬ К ОТКРЫТИЮ БУНКЕРА</p></>
          ) : (
            <>
              <p>СОБЕРИТЕ ДАННЫЕ ВСЕХ ВАГОНОВ И ВВЕДИТЕ ИХ В ТЕРМИНАЛ НА ТЕЛЕФОНАХ</p>
              <strong>{model.solved} / {model.total} ПАРАМЕТРОВ</strong>
              {model.wrongAttempts > 0 && <span>ПРОВЕРОК: {model.wrongAttempts}</span>}
              {model.hintLevel > 0 && <small>СИСТЕМА ВЫДАЛА ПОДСКАЗКУ УРОВНЯ {model.hintLevel}</small>}
            </>
          )}
        </section>
        <figure className="bunker-v2-final-screen__couple">
          <picture>
            <source srcSet="/images/bunker/story/couple-epilogue.avif" type="image/avif" />
            <img
              src="/images/bunker/story/couple-epilogue.webp"
              width={1536}
              height={1024}
              alt="Лиза и Виктор вместе после прибытия поезда"
              loading="eager"
              decoding="async"
            />
          </picture>
          <figcaption>ЛИЗА И ВИКТОР · ФИНАЛ ПУТЕШЕСТВИЯ</figcaption>
        </figure>
      </main>
      <footer>ПОЕЗД ИДЁТ К ТОЧКЕ ПРИБЫТИЯ · ТАЙМЕР СЕРВЕРНЫЙ</footer>
    </section>
  );
}
