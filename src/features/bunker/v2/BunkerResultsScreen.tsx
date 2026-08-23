import { useState } from 'react';
import type { BunkerV2ResultSummary } from './results.service';

export type BunkerResultsScreenModel = Omit<BunkerV2ResultSummary, 'contractVersion' | 'status' | 'serverNow'>;

function duration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function scoreMessage(score: number): string {
  if (score >= 90) return 'СОСТАВ СРАБОТАЛ КАК ОДНА КОМАНДА';
  if (score >= 75) return 'КОМАНДА ДОШЛА ДО БУНКЕРА УВЕРЕННО';
  if (score >= 55) return 'БЫЛО НЕПРОСТО, НО СОСТАВ СПРАВИЛСЯ';
  return 'ГЛАВНОЕ — СОСТАВ ДОБРАЛСЯ ДО БУНКЕРА';
}

export function BunkerResultsScreen({ model }: { model: BunkerResultsScreenModel }) {
  const [epilogueImageAvailable, setEpilogueImageAvailable] = useState(true);
  return (
    <section className="bunker-v2-screen bunker-v2-results" aria-label="Бункер открыт · итоги игры">
      <header className="bunker-v2-results__hero">
        <p>ФИНАЛЬНЫЙ ПРОТОКОЛ ЗАВЕРШЁН</p>
        <h1>БУНКЕР ОТКРЫТ</h1>
        <strong>{scoreMessage(model.coordinationScore)}</strong>
      </header>

      <main>
        <section className="bunker-v2-results__score" aria-label="Командная работа">
          <span>КОМАНДНАЯ РАБОТА</span>
          <strong>{model.coordinationScore} / 100</strong>
          <p>{model.emergencyOpen ? 'Бункер был открыт ведущим в аварийном режиме.' : `Финальный терминал пройден за ${duration(model.finishTimeSeconds)}.`}</p>
        </section>

        <div className="bunker-v2-results__grid">
          <article><span>ПЕРСОНАЖИ</span><strong>{model.characters.saved} персонажей спасено</strong><small>{model.characters.excluded} исключено · {model.characters.active} осталось активно</small></article>
          <article><span>АРХИВ</span><strong>{model.archiveFound} материалов найдено</strong><small>Найденные досье и фрагменты истории</small></article>
          <article><span>РЕСУРСЫ</span><strong>{model.resourcesRemaining} осталось</strong><small>{model.resourcesUsed} использовано по пути</small></article>
          <article><span>МЕЖВАГОННАЯ РАБОТА</span><strong>{model.tradesCompleted} обменов</strong><small>{model.skillsUsed} особых способностей использовано</small></article>
          <article><span>ЗАДАНИЯ</span><strong>{model.missionsCompleted} / {model.missionsTotal} этапов завершено</strong><small>Результаты предыдущих решений вошли в финал</small></article>
          <article><span>ФИНАЛ</span><strong>{model.wrongAttempts} неверных проверок</strong><small>{model.hintsUsed} уровней подсказок использовано</small></article>
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
      </main>

      <footer>ПОЕЗД ПРИБЫЛ · ВСЕ ГОСТИ ОСТАЮТСЯ В ИГРЕ ДО ФИНАЛЬНОЙ СЦЕНЫ</footer>
    </section>
  );
}
