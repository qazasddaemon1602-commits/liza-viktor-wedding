import { useState } from 'react';
import type { BunkerResultsScreenModel } from './BunkerResultsScreen';

function duration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function BunkerResultsPlayer({ model }: { model: BunkerResultsScreenModel }) {
  const [epilogueImageAvailable, setEpilogueImageAvailable] = useState(true);
  return (
    <section className="bunker-v2-mission bunker-v2-results-player" aria-label="Итоги Бункера">
      <header className="bunker-v2-results-player__hero">
        <span>ФИНАЛ</span>
        <h1>БУНКЕР ОТКРЫТ</h1>
        <p>Ваш состав справился. Все игровые решения сохранены в общей истории.</p>
      </header>

      <div className="bunker-v2-results-player__score">
        <span>КОМАНДНАЯ РАБОТА</span>
        <strong>{model.coordinationScore} / 100</strong>
        <small>{model.emergencyOpen ? 'Аварийное открытие ведущим' : `Терминал: ${duration(model.finishTimeSeconds)}`}</small>
      </div>

      <div className="bunker-v2-results-player__facts">
        <p><strong>{model.characters.saved}</strong> персонажей спасено</p>
        <p><strong>{model.archiveFound}</strong> материалов найдено</p>
        <p><strong>{model.resourcesRemaining}</strong> ресурсов осталось</p>
        <p><strong>{model.tradesCompleted}</strong> обменов между вагонами</p>
        <p><strong>{model.skillsUsed}</strong> способностей помогли команде</p>
      </div>

      <section className="bunker-results-epilogue" aria-label="Эпилог Лизы и Виктора">
        {epilogueImageAvailable && (
          <picture>
            <source srcSet="/images/bunker/story/couple-epilogue.avif" type="image/avif" />
            <img
              src="/images/bunker/story/couple-epilogue.webp"
              alt="Лиза и Виктор вместе после прибытия поезда"
              onError={() => setEpilogueImageAvailable(false)}
            />
          </picture>
        )}
        <div><span>ЭПИЛОГ</span><p>Поезд Виктора прибыл к Лизе. Теперь маршрут продолжается вместе.</p></div>
      </section>

      <p className="bunker-v2-results-player__ending">Игра завершена. Оставайтесь вместе — финальная сцена показывается на общем экране.</p>
    </section>
  );
}
