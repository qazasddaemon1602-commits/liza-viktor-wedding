import { useEffect, useRef, useState } from 'react';
import type { MissionFiveOutcome, MissionFiveRoute } from './m05.service';

export type MissionFivePlayerReadModel = {
  instanceId: string;
  status: 'active' | 'completed';
  remainingSeconds: number;
  title: string;
  intro: string;
  routes: MissionFiveRoute[];
  selectedVote: 'A' | 'B' | null;
  voteCounts: { A: number; B: number; total: number; required: number };
  ability: { available: boolean; key: string; label: string; hint: string } | null;
  connection: 'online' | 'reconnecting';
  outcome?: MissionFiveOutcome;
};

function timer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function minutes(value: number) {
  return `${value > 0 ? '+' : ''}${value} мин`;
}

export function MissionFivePlayer({
  model,
  onVote,
  onUseAbility,
}: {
  model: MissionFivePlayerReadModel;
  onVote?: (vote: 'A' | 'B') => Promise<void> | void;
  onUseAbility?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [localVote, setLocalVote] = useState<'A' | 'B' | null>(model.selectedVote);
  const [actionError, setActionError] = useState('');
  const authoritativeVote = useRef(model.selectedVote);
  authoritativeVote.current = model.selectedVote;

  useEffect(() => {
    setLocalVote(model.selectedVote);
    setActionError('');
    setBusy(false);
  }, [model.instanceId, model.selectedVote]);

  const vote = async (key: 'A' | 'B') => {
    if (!onVote || busy || localVote !== null) return;
    setLocalVote(key);
    setActionError('');
    setBusy(true);
    try {
      await onVote(key);
    } catch {
      const latestVote = authoritativeVote.current;
      setLocalVote(latestVote);
      setActionError(latestVote === null ? 'Голос не отправлен. Проверьте связь и попробуйте ещё раз.' : '');
    } finally {
      setBusy(false);
    }
  };

  const useAbility = async () => {
    if (!onUseAbility || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await onUseAbility();
    } catch {
      setActionError('Подсказку не удалось получить. Проверьте связь и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bunker-v2-mission bunker-v2-mission--m05" aria-label="Задание 5 · Один шанс">
      <header className="bunker-v2-mission__header">
        <div><span>ЗАДАНИЕ 5</span><h1>{model.title}</h1></div>
        <time>{timer(model.remainingSeconds)}</time>
      </header>
      <p className="bunker-v2-mission__intro">{model.intro}</p>
      {model.connection === 'reconnecting' && <p role="status">Связь восстанавливается. Уже отправленный голос сохранён.</p>}
      {model.status === 'completed' && model.outcome ? (
        <div className="bunker-v2-mission__result" role="status">
          <h2>МАРШРУТ {model.outcome.routeChoice} ПРИНЯТ</h2>
          <p>Изменение финального времени: {minutes(model.outcome.routeBonusMinutes)}. Повреждение пути: +{model.outcome.trackDamage}. Нестабильность питания: +{model.outcome.powerInstability}.</p>
          {model.outcome.sector04Found && <strong>В СЛУЖЕБНОЙ СХЕМЕ ОБНАРУЖЕН СЕКТОР 04</strong>}
          {model.outcome.fallback && <small>Время истекло — применён безопасный резервный маршрут.</small>}
        </div>
      ) : (
        <>
          <section aria-label="Выберите маршрут" className="bunker-v2-route-grid">
            {model.routes.map((route) => (
              <article key={route.key}>
                <span>МАРШРУТ {route.key}</span>
                <h2>{route.title}</h2>
                <p>{route.description}</p>
                <small>{route.risk}</small>
                <button
                  className="bunker-v2-mission__primary"
                  type="button"
                  disabled={busy || localVote !== null || !onVote}
                  aria-pressed={localVote === route.key}
                  onClick={() => void vote(route.key)}
                  aria-label={`${route.key} · ${route.title.toLocaleUpperCase('ru-RU')}`}
                >
                  {route.key} · {route.title.toLocaleUpperCase('ru-RU')}
                </button>
              </article>
            ))}
          </section>

          {localVote && (
            <p className="bunker-v2-mission__answer-status" role="status" aria-label="Состояние вашего выбора">
              <strong>Маршрут {localVote} принят.</strong>
              <span>Ждём большинство замороженного состава вагона.</span>
            </p>
          )}
          {actionError && <p className="bunker-v2-mission__error" role="alert">{actionError}</p>}

          <details className="bunker-v2-mission__secondary">
            <summary>ДЕТАЛИ ГОЛОСОВАНИЯ</summary>
            <p className="bunker-v2-vote-progress">A {model.voteCounts.A} · B {model.voteCounts.B} · для решения нужно {model.voteCounts.required} голосов замороженного состава</p>
            {model.ability?.available && (
              <aside className="bunker-v2-mission__ability">
                <strong>ВАША СПОСОБНОСТЬ МОЖЕТ ПОМОЧЬ</strong>
                <p>{model.ability.hint}</p>
                <button type="button" disabled={busy || !onUseAbility} onClick={() => void useAbility()}>ИСПОЛЬЗОВАТЬ · {model.ability.label.toLocaleUpperCase('ru-RU')}</button>
              </aside>
            )}
            {model.ability && !model.ability.available && <p className="bunker-v2-mission__hint">{model.ability.hint}</p>}
          </details>
        </>
      )}
    </section>
  );
}
