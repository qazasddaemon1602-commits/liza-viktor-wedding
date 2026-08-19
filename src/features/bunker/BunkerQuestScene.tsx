import type { BunkerPhase } from './bunkerQuest.types';
import type { BunkerScreenState, BunkerScreenTeamState } from './bunker.service';

type ActiveBunkerScreen = Extract<BunkerScreenState, { status: 'active' }>;

type BunkerQuestSceneProps = {
  state: ActiveBunkerScreen;
  remainingSeconds: number;
};

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function phaseTitle(phase: BunkerPhase): string {
  switch (phase) {
    case 'dossier_1': return 'ЛИЧНЫЕ ДОСЬЕ · ЭТАП I';
    case 'dossier_2': return 'ЛИЧНЫЕ ДОСЬЕ · ЭТАП II';
    case 'mission_a': return 'КОМАНДНАЯ ЗАДАЧА A';
    case 'mission_b': return 'КОМАНДНАЯ ЗАДАЧА B';
    case 'final': return 'ФИНАЛЬНЫЙ ДОСТУП';
    case 'completed': return 'ДОСТУП ПОЛУЧЕН';
    case 'emergency': return 'ЭКСТРЕННОЕ СООБЩЕНИЕ';
  }
}

function teamComplete(team: BunkerScreenTeamState, phase: BunkerPhase): boolean {
  if (phase === 'mission_a') return team.missionAComplete;
  if (phase === 'mission_b' || phase === 'final' || phase === 'completed') return team.missionBComplete;
  return false;
}

function progressLabel(state: ActiveBunkerScreen): string | null {
  if (state.phase === 'mission_a') {
    return `${state.teams.filter((team) => team.missionAComplete).length} / ${state.teams.length} ГОТОВО`;
  }
  if (state.phase === 'mission_b') {
    return `${state.teams.filter((team) => team.missionBComplete).length} / ${state.teams.length} ГОТОВО`;
  }
  if (state.phase === 'final' || state.phase === 'completed') {
    return `${state.teams.filter((team) => team.missionBComplete).length} / ${state.teams.length} ФРАГМЕНТОВ`;
  }
  return null;
}

export function BunkerQuestScene({ state, remainingSeconds }: BunkerQuestSceneProps) {
  const progress = progressLabel(state);
  const arrived = remainingSeconds <= 0;
  const finalPhase = state.phase === 'final' || state.phase === 'completed';

  const headline = arrived && finalPhase
    ? state.unlocked
      ? 'ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН'
      : 'ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН'
    : phaseTitle(state.phase);

  return (
    <section className={`bunker-quest-scene bunker-quest-scene--${state.phase}`} aria-label="Бункер · экран квеста">
      <div className="bunker-quest-scene__grid" aria-hidden="true" />
      <header className="bunker-quest-scene__header">
        <div>
          <p>ПОЕЗД ВИКТОРА · ПРОТОКОЛ БУНКЕРА · 30.08.2026</p>
          <h1>{headline}</h1>
        </div>
        <strong>{formatTimer(remainingSeconds)}</strong>
      </header>

      {(state.phase === 'dossier_1' || state.phase === 'dossier_2') && (
        <div className="bunker-quest-scene__briefing">
          <span>ЛИЧНЫЕ ТЕРМИНАЛЫ АКТИВНЫ</span>
          <strong>{state.phase === 'dossier_1' ? 'СВЕРЬТЕ ПЕРВЫЕ ДАННЫЕ ВНУТРИ ВАГОНА' : 'ДОСЬЕ РАСКРЫТО · ГОТОВЬТЕСЬ К КОМАНДНОЙ ЗАДАЧЕ'}</strong>
          <p>Телефоны гостей синхронизированы с текущим этапом.</p>
        </div>
      )}

      {(state.phase === 'mission_a' || state.phase === 'mission_b') && (
        <div className="bunker-quest-scene__mission">
          <div className="bunker-quest-scene__progress-heading">
            <span>СОСТОЯНИЕ ВАГОНОВ</span>
            {progress && <strong>{progress}</strong>}
          </div>
          <div className="bunker-quest-scene__teams">
            {state.teams.map((team) => {
              const complete = teamComplete(team, state.phase);
              return (
                <article key={team.carriageNumber} className={complete ? 'is-complete' : ''}>
                  <span>{String(team.carriageNumber).padStart(2, '0')}</span>
                  <strong>{team.label}</strong>
                  <i>{complete ? 'ГОТОВ' : 'В РАБОТЕ'}</i>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {finalPhase && (
        <div className="bunker-quest-scene__final">
          <div className="bunker-quest-scene__progress-heading">
            <span>КОНТУР ФИНАЛЬНОГО ДОСТУПА</span>
            {progress && <strong>{progress}</strong>}
          </div>
          <div className="bunker-quest-scene__slots">
            {state.teams.map((team) => (
              <article key={team.carriageNumber} className={team.missionBComplete ? 'is-open' : ''}>
                <span>ВАГОН {String(team.carriageNumber).padStart(2, '0')}</span>
                <strong>{team.missionBComplete ? 'OPEN' : 'LOCKED'}</strong>
              </article>
            ))}
          </div>
          {state.unlocked && remainingSeconds > 0 && (
            <div className="bunker-quest-scene__unlock-state">
              <strong>ДОСТУП ПОЛУЧЕН</strong>
              <span>ОЖИДАЕМ ПРИБЫТИЕ</span>
            </div>
          )}
        </div>
      )}

      <footer>
        <span>LV · BUNKER ARCHIVE</span>
        <span>СИСТЕМА · ONLINE</span>
      </footer>
    </section>
  );
}
