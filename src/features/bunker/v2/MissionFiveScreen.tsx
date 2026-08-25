export type MissionFiveScreenModel = {
  title: string;
  remainingSeconds: number;
  wagons: Array<{
    wagonId: string;
    label: string;
    status: 'active' | 'completed';
    votesA: number;
    votesB: number;
    required: number;
    routeChoice: 'A' | 'B' | null;
  }>;
};

export function MissionFiveScreen({ model }: { model: MissionFiveScreenModel }) {
  return (
    <section className="bunker-v2-screen bunker-v2-screen--m05" aria-label="Задание 5 · общий экран">
      <header>
        <div><p>ЗАДАНИЕ 5 · ОДИН ШАНС</p><h1>{model.title.toLocaleUpperCase('ru-RU')}</h1></div>
        <time><strong>{Math.max(0, Math.floor(model.remainingSeconds))}</strong><small>СЕКУНД</small></time>
      </header>
      <main>
        <p>КАЖДЫЙ ВАГОН ВЫБИРАЕТ МАРШРУТ A ИЛИ B</p>
        <div className="bunker-wagon-grid" data-count={model.wagons.length}>
          {model.wagons.map((wagon) => (
            <article key={wagon.wagonId} className={wagon.status === 'completed' ? 'is-complete' : ''}>
              <h2>{wagon.label}</h2>
              <strong>{wagon.status === 'completed' && wagon.routeChoice ? `МАРШРУТ ${wagon.routeChoice}` : 'ОБСУЖДЕНИЕ МАРШРУТА'}</strong>
              <span>{wagon.status === 'completed' ? 'РЕШЕНИЕ ПРИНЯТО' : 'РЕШЕНИЕ ЕЩЁ ОБСУЖДАЕТСЯ'}</span>
            </article>
          ))}
        </div>
      </main>
    </section>
  );
}
