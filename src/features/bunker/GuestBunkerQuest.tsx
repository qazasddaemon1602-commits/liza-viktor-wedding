import { useState } from 'react';
import type {
  BunkerMissionStage,
  GuestBunkerQuestState,
} from './bunkerQuest.types';

type ActiveState = Extract<GuestBunkerQuestState, { status: 'active' }>;

type GuestBunkerQuestProps = {
  state: ActiveState;
  submitting?: boolean;
  feedback?: string;
  onMission: (stage: BunkerMissionStage, answer: string) => Promise<void> | void;
  onFinalCode: (code: string) => Promise<void> | void;
};

function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function DossierRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bunker-dossier-row">
      <span>{label}</span>
      <strong>{value ?? 'СКРЫТО ДО КОМАНДЫ ВЕДУЩЕГО'}</strong>
    </div>
  );
}

export function GuestBunkerQuest({
  state,
  submitting = false,
  feedback = '',
  onMission,
  onFinalCode,
}: GuestBunkerQuestProps) {
  const [missionAnswer, setMissionAnswer] = useState('');
  const [finalCode, setFinalCode] = useState('');
  const mission = state.team?.mission;
  const missionStage = state.team?.stage;
  const hasOptions = Boolean(mission?.options.length);

  const submitTypedMission = () => {
    if (!missionStage || !missionAnswer.trim() || submitting) return;
    void onMission(missionStage, missionAnswer.trim());
  };

  const submitFinal = () => {
    const normalized = finalCode.replace(/\D/g, '');
    if (!normalized || submitting) return;
    void onFinalCode(normalized);
  };

  return (
    <section className={`guest-bunker-quest guest-bunker-quest--${state.phase}`} aria-label="Бункер">
      <header className="guest-bunker-quest__header">
        <div>
          <p className="eyebrow">БУНКЕР · СИСТЕМА ОПОВЕЩЕНИЯ</p>
          <h2>{state.phase === 'emergency' ? 'ПОЕЗД ИЗМЕНИЛ МАРШРУТ' : 'ПРОТОКОЛ БУНКЕРА'}</h2>
        </div>
        <strong className="guest-bunker-quest__clock">{clock(state.remainingSeconds)}</strong>
      </header>

      {state.phase === 'emergency' && (
        <div className="guest-bunker-emergency-copy">
          <strong>ЕДИНСТВЕННАЯ БЕЗОПАСНАЯ ТОЧКА — БУНКЕР.</strong>
          <p>Оставайтесь на этой странице. Когда ведущий запустит протокол, ваше досье появится здесь автоматически.</p>
        </div>
      )}

      {state.dossier && state.phase !== 'emergency' && (
        <div className="guest-bunker-dossier">
          <div className="guest-bunker-section-title">
            <span>ЛИЧНОЕ ДЕЛО</span>
            <small>ДАННЫЕ НЕ МЕНЯЮТСЯ ДО КОНЦА ПРОТОКОЛА</small>
          </div>
          <DossierRow label="ПРОФЕССИЯ" value={state.dossier.profession} />
          <DossierRow label="ПРОФИЛЬ" value={state.dossier.profile} />
          <DossierRow label="СОСТОЯНИЕ" value={state.dossier.health} />
          <DossierRow label="НАВЫК / ХОББИ" value={state.dossier.hobby} />
          <DossierRow label="БАГАЖ" value={state.dossier.baggage} />
          <DossierRow label="СКРЫТЫЙ ФАКТ" value={state.dossier.hiddenFact} />
        </div>
      )}

      {(state.phase === 'dossier_1' || state.phase === 'dossier_2') && (
        <div className="guest-bunker-briefing">
          <p className="eyebrow">КОМАНДА · ВАГОН {state.team?.carriageNumber ?? '—'}</p>
          <strong>{state.phase === 'dossier_1' ? 'СРАВНИТЕ ПЕРВЫЕ ДАННЫЕ С ВАГОНОМ' : 'ДОСЬЕ РАСКРЫТО · ГОТОВЬТЕСЬ К ЗАДАНИЮ'}</strong>
        </div>
      )}

      {(state.phase === 'mission_a' || state.phase === 'mission_b') && state.team && (
        <div className="guest-bunker-mission">
          <div className="guest-bunker-section-title">
            <span>{state.phase === 'mission_a' ? 'КОМАНДНАЯ ЗАДАЧА A' : 'КОМАНДНАЯ ЗАДАЧА B'}</span>
            <small>ВАГОН {state.team.carriageNumber}</small>
          </div>

          {state.team.completed ? (
            <div className="guest-bunker-success" role="status">
              <strong>ЗАДАНИЕ ВЫПОЛНЕНО</strong>
              {state.team.fragment && (
                <div className="guest-bunker-fragment">
                  <span>ФРАГМЕНТ ВАГОНА</span>
                  <b>{state.team.fragment}</b>
                </div>
              )}
              <p>Ожидайте остальные вагоны и следующую команду ведущего.</p>
            </div>
          ) : mission ? (
            <>
              <h3>{mission.title}</h3>
              <p>{mission.prompt}</p>
              {hasOptions ? (
                <div className="guest-bunker-options">
                  {mission.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={submitting}
                      onClick={() => { if (missionStage) void onMission(missionStage, option); }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="guest-bunker-answer">
                  <label>
                    <span>ОТВЕТ ВАГОНА</span>
                    <input
                      value={missionAnswer}
                      disabled={submitting}
                      onChange={(event) => setMissionAnswer(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') submitTypedMission(); }}
                    />
                  </label>
                  <button type="button" disabled={submitting || !missionAnswer.trim()} onClick={submitTypedMission}>
                    ПРОВЕРИТЬ ОТВЕТ
                  </button>
                </div>
              )}
              {feedback && <p className="guest-bunker-feedback" role="status">{feedback}</p>}
            </>
          ) : (
            <p>Задание синхронизируется…</p>
          )}
        </div>
      )}

      {(state.phase === 'final' || state.phase === 'completed') && (
        <div className="guest-bunker-final">
          {state.team?.fragment && (
            <div className="guest-bunker-fragment guest-bunker-fragment--final">
              <span>ВАШ ФРАГМЕНТ · ВАГОН {state.team.carriageNumber}</span>
              <b>{state.team.fragment}</b>
            </div>
          )}

          {state.final.unlocked ? (
            <div className="guest-bunker-unlocked" role="status">
              <p className="eyebrow">ШЛЮЗ · OPEN</p>
              <strong>ДОСТУП ПОЛУЧЕН</strong>
              <span>{state.remainingSeconds > 0 ? 'ОЖИДАЕМ ПРИБЫТИЕ' : 'ПРИБЫТИЕ · ДОСТУП РАЗРЕШЁН'}</span>
            </div>
          ) : (
            <div className="guest-bunker-terminal">
              <p className="eyebrow">ФИНАЛЬНЫЙ ДОСТУП</p>
              <h3>{state.remainingSeconds > 0 ? 'СОБЕРИТЕ ФРАГМЕНТЫ 1 → 5' : 'ПРИБЫТИЕ · ШЛЮЗ ЗАБЛОКИРОВАН'}</h3>
              <label>
                <span>Общий код Бункера</span>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={finalCode}
                  disabled={submitting}
                  onChange={(event) => setFinalCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  onKeyDown={(event) => { if (event.key === 'Enter') submitFinal(); }}
                />
              </label>
              <button type="button" disabled={submitting || !finalCode} onClick={submitFinal}>
                ОТКРЫТЬ ШЛЮЗ
              </button>
              {feedback && <p className="guest-bunker-feedback" role="status">{feedback}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
