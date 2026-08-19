import type {
  BunkerMissionStage,
  BunkerPhase,
  OwnerBunkerQuestState,
  OwnerBunkerTeamState,
} from '../../bunker/bunkerQuest.types';

type ActiveOwnerState = Extract<OwnerBunkerQuestState, { status: 'active' }>;

type BunkerQuestOwnerPanelProps = {
  state: ActiveOwnerState;
  busy?: string;
  onBegin: () => void;
  onAdvance: (phase: BunkerPhase) => void;
  onReset: (carriageId: string, stage: BunkerMissionStage) => void;
  onForce: (carriageId: string, stage: BunkerMissionStage) => void;
  onUnlock: () => void;
};

function phaseTitle(phase: BunkerPhase): string {
  switch (phase) {
    case 'emergency': return 'ЭКСТРЕННОЕ СООБЩЕНИЕ';
    case 'dossier_1': return 'ДОСЬЕ · ЭТАП I';
    case 'dossier_2': return 'ДОСЬЕ · ЭТАП II';
    case 'mission_a': return 'КОМАНДНАЯ ЗАДАЧА A';
    case 'mission_b': return 'КОМАНДНАЯ ЗАДАЧА B';
    case 'final': return 'ФИНАЛЬНЫЙ ДОСТУП';
    case 'completed': return 'БУНКЕР ОТКРЫТ';
  }
}

function currentStage(phase: BunkerPhase): BunkerMissionStage | null {
  if (phase === 'mission_a' || phase === 'mission_b') return phase;
  return null;
}

function completedFor(team: OwnerBunkerTeamState, stage: BunkerMissionStage): boolean {
  return stage === 'mission_a' ? team.missionA.completed : team.missionB.completed;
}

function attemptsFor(team: OwnerBunkerTeamState, stage: BunkerMissionStage): number {
  return stage === 'mission_a' ? team.missionA.attemptCount : team.missionB.attemptCount;
}

function hintFor(team: OwnerBunkerTeamState, stage: BunkerMissionStage): string | null {
  return stage === 'mission_a' ? team.missionA.hint : team.missionB.hint;
}

function nextPhase(phase: BunkerPhase): { phase: BunkerPhase; label: string } | null {
  switch (phase) {
    case 'dossier_1': return { phase: 'dossier_2', label: 'РАСКРЫТЬ ДОСЬЕ II' };
    case 'dossier_2': return { phase: 'mission_a', label: 'ОТКРЫТЬ ЗАДАНИЕ A' };
    case 'mission_a': return { phase: 'mission_b', label: 'ОТКРЫТЬ ЗАДАНИЕ B' };
    case 'mission_b': return { phase: 'final', label: 'ОТКРЫТЬ ФИНАЛЬНЫЙ ДОСТУП' };
    case 'final': return { phase: 'completed', label: 'ЗАВЕРШИТЬ ПРОТОКОЛ' };
    default: return null;
  }
}

export function BunkerQuestOwnerPanel({
  state,
  busy = '',
  onBegin,
  onAdvance,
  onReset,
  onForce,
  onUnlock,
}: BunkerQuestOwnerPanelProps) {
  const stage = currentStage(state.phase);
  const completeCount = stage
    ? state.teams.filter((team) => completedFor(team, stage)).length
    : 0;
  const allReady = stage ? state.teams.length > 0 && completeCount === state.teams.length : true;
  const next = nextPhase(state.phase);
  const nextDisabled = Boolean(
    busy
    || (stage && !allReady)
    || (state.phase === 'final' && !state.unlocked),
  );

  return (
    <section className="admin-bunker-quest" aria-label="Управление квестом Бункер">
      <div className="admin-bunker-quest__heading">
        <div>
          <p className="eyebrow">ПРОТОКОЛ БУНКЕРА</p>
          <h3>{phaseTitle(state.phase)}</h3>
        </div>
        {stage && <strong>{completeCount} / {state.teams.length} ГОТОВО</strong>}
      </div>

      {state.phase === 'emergency' && (
        <div className="admin-bunker-quest__briefing">
          <p>Экстренное сообщение уже на экранах. Когда гости увидели смену маршрута — откройте личные досье.</p>
          <button type="button" disabled={Boolean(busy)} onClick={onBegin}>
            НАЧАТЬ КВЕСТ · ОТКРЫТЬ ДОСЬЕ
          </button>
        </div>
      )}

      {state.phase !== 'emergency' && (
        <div className="admin-bunker-team-grid">
          {state.teams.map((team) => {
            const isComplete = stage ? completedFor(team, stage) : false;
            const attempts = stage ? attemptsFor(team, stage) : 0;
            const hint = stage ? hintFor(team, stage) : null;
            return (
              <article key={team.carriageId} className={isComplete ? 'is-complete' : ''}>
                <div className="admin-bunker-team-card__heading">
                  <strong>{team.label}</strong>
                  {stage && <span>{isComplete ? 'ГОТОВ' : 'В РАБОТЕ'}</span>}
                </div>

                {stage && (
                  <>
                    <p>ПОПЫТОК · {attempts}</p>
                    {hint && <small>OWNER HINT · {hint}</small>}
                    <div className="admin-bunker-team-card__actions">
                      {isComplete ? (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          aria-label={`СБРОСИТЬ · ${team.label}`}
                          onClick={() => onReset(team.carriageId, stage)}
                        >
                          СБРОСИТЬ
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          aria-label={`ЗАВЕРШИТЬ ВРУЧНУЮ · ${team.label}`}
                          onClick={() => onForce(team.carriageId, stage)}
                        >
                          ЗАВЕРШИТЬ ВРУЧНУЮ
                        </button>
                      )}
                    </div>
                  </>
                )}

                {state.phase === 'mission_b' || state.phase === 'final' || state.phase === 'completed' ? (
                  <div className="admin-bunker-team-fragment">
                    <span>ФРАГМЕНТ</span>
                    <b>{team.missionB.fragment ?? '··'}</b>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {stage && !allReady && (
        <p className="admin-bunker-quest__waiting">Ожидаем остальные вагоны. Переход остаётся под контролем ведущего.</p>
      )}

      {state.phase === 'final' && !state.unlocked && (
        <div className="admin-bunker-manual-unlock">
          <p>Если телефоны или сеть мешают финальному вводу, откройте шлюз вручную. Это аварийный fallback.</p>
          <button type="button" disabled={Boolean(busy)} onClick={onUnlock}>
            ОТКРЫТЬ БУНКЕР ВРУЧНУЮ
          </button>
        </div>
      )}

      {state.phase === 'final' && state.unlocked && (
        <strong className="admin-bunker-unlocked">ДОСТУП ПОЛУЧЕН · ОЖИДАЕМ ПРИБЫТИЕ</strong>
      )}

      {next && (
        <button
          type="button"
          className="admin-bunker-next"
          disabled={nextDisabled}
          onClick={() => onAdvance(next.phase)}
        >
          {next.label}
        </button>
      )}
    </section>
  );
}
