import { BunkerResponsivePicture } from '../BunkerResponsivePicture';

export type MissionOneScreenWagon = {
  wagonId: string;
  label: string;
  status: 'active' | 'completed';
};

export type MissionOneScreenReadModel = {
  title: string;
  publicSummary: string;
  remainingSeconds: number;
  wagons: readonly MissionOneScreenWagon[];
};

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function MissionOneScreen({ model }: { model: MissionOneScreenReadModel }) {
  const completed = model.wagons.filter((wagon) => wagon.status === 'completed').length;

  return (
    <section className="bunker-mission-one-screen" aria-label="Задание 1 · общий экран">
      <BunkerResponsivePicture
        asset="bunker-exterior"
        className="bunker-mission-one-screen__backdrop"
        testId="bunker-mission-one-backdrop"
        loading="eager"
      />
      <header className="bunker-mission-one-screen__header">
        <div>
          <p>ПОЕЗД ВИКТОРА · ПРОТОКОЛ БУНКЕРА · ЗАДАНИЕ 1 · ЛИШНИЙ ПАССАЖИР</p>
          <h1>{model.title.toLocaleUpperCase('ru-RU')}</h1>
        </div>
        <time dateTime={`PT${Math.max(0, model.remainingSeconds)}S`} aria-label="До конца задания">
          {formatTimer(model.remainingSeconds)}
        </time>
      </header>

      <main className="bunker-mission-one-screen__main">
        <div className="bunker-mission-one-screen__summary">
          <span>РЕШЕНИЕ ПРИНИМАЮТ НА ТЕЛЕФОНАХ</span>
          <p>{model.publicSummary}</p>
          <strong>{completed} / {model.wagons.length} ГОТОВО</strong>
        </div>

        {model.wagons.length > 0 ? (
          <ul
            className="bunker-mission-one-screen__wagons"
            aria-label="Прогресс вагонов"
            data-count={model.wagons.length}
          >
            {model.wagons.map((wagon, index) => (
              <li key={wagon.wagonId} className={wagon.status === 'completed' ? 'is-complete' : ''}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{wagon.label}</strong>
                <b>{wagon.status === 'completed' ? 'РЕШЕНИЕ ПРИНЯТО' : 'ОБСУЖДЕНИЕ'}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bunker-mission-one-screen__empty">ДАННЫЕ ОБ АКТИВНЫХ ВАГОНАХ НЕ ПОЛУЧЕНЫ</p>
        )}
      </main>

      <footer>
        <span>LV · BUNKER ARCHIVE</span>
        <span>ПУБЛИЧНЫЙ ПРОГРЕСС · ONLINE</span>
      </footer>
    </section>
  );
}
