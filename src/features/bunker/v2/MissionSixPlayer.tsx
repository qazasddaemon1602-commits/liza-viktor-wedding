import { useEffect, useRef, useState } from 'react';
import type {
  MissionSixConsensus,
  MissionSixFragment,
  MissionSixOption,
  MissionSixOutcome,
} from './m06.service';

export type MissionSixPlayerReadModel = {
  instanceId: string;
  status: 'active' | 'completed';
  remainingSeconds: number;
  title: string;
  intro: string;
  viewer: { wagonId: string; wagonNumber: number; canVote: boolean };
  privateFragment: MissionSixFragment;
  fragmentShared: boolean;
  revealedFragments: MissionSixFragment[];
  fragmentsRevealed: number;
  fragmentsTotal: number;
  options: MissionSixOption[];
  selectedVote: 'A' | 'B' | 'C' | null;
  wagonConsensus: MissionSixConsensus[];
  ability: { available: boolean; key: string; label: string; hint: string } | null;
  connection: 'online' | 'reconnecting';
  outcome?: MissionSixOutcome;
};

type Vote = 'A' | 'B' | 'C';
type VoteState = 'idle' | 'sending' | 'sent' | 'error';

function timer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function MissionSixPlayer({
  model,
  onReveal,
  onVote,
  onUseAbility,
}: {
  model: MissionSixPlayerReadModel;
  onReveal?: () => Promise<void> | void;
  onVote?: (vote: Vote) => Promise<void> | void;
  onUseAbility?: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [localVote, setLocalVote] = useState<Vote | null>(model.selectedVote);
  const [voteState, setVoteState] = useState<VoteState>('idle');
  const revealedInstance = useRef<string | null>(null);
  const mine = model.wagonConsensus.find((wagon) => wagon.wagonId === model.viewer.wagonId);

  useEffect(() => {
    setLocalVote(model.selectedVote);
    setVoteState('idle');
  }, [model.instanceId, model.selectedVote]);

  useEffect(() => {
    if (
      model.status !== 'active'
      || model.fragmentShared
      || !onReveal
      || revealedInstance.current === model.instanceId
    ) return;
    revealedInstance.current = model.instanceId;
    void Promise.resolve().then(onReveal).catch(() => undefined);
  }, [model.fragmentShared, model.instanceId, model.status, onReveal]);

  const castVote = async (vote: Vote) => {
    if (!onVote || !model.viewer.canVote || busy) return;
    setLocalVote(vote);
    setVoteState('sending');
    setBusy(true);
    try {
      await onVote(vote);
      setVoteState('sent');
    } catch {
      setLocalVote(model.selectedVote);
      setVoteState('error');
    } finally {
      setBusy(false);
    }
  };

  const useAction = async (action?: () => Promise<void> | void) => {
    if (!action || busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const authoritativeAccepted = localVote !== null && model.selectedVote === localVote;

  return (
    <section className="bunker-v2-mission bunker-v2-mission--m06" aria-label="Задание 6 · Общий протокол">
      <header className="bunker-v2-mission__header">
        <div><span>ЗАДАНИЕ 6</span><h1>{model.title}</h1></div>
        <time>{timer(model.remainingSeconds)}</time>
      </header>
      <p className="bunker-v2-mission__intro">{model.intro}</p>
      <section className="bunker-v2-mission__next-step" aria-label="Что делать сейчас">
        <strong>ЧТО ДЕЛАТЬ СЕЙЧАС</strong>
        <p>Фрагмент передаётся автоматически. Сравните общие данные и выберите один протокол A, B или C.</p>
      </section>
      {model.connection === 'reconnecting' && <p role="status">Связь восстанавливается. Переданные фрагменты и голоса сохранены.</p>}
      {model.status === 'completed' && model.outcome ? (
        <div className="bunker-v2-mission__result" role="status">
          <h2>ОБЩИЙ ПРОТОКОЛ ПОДТВЕРЖДЁН</h2>
          <p>Маршрут: TUNNEL B · SECTOR {model.outcome.sector}</p>
          <strong>КОД ДОСТУПА · {model.outcome.accessCode}</strong>
          <small>Сектор и код добавлены в общий архив. Они понадобятся в финале.</small>
        </div>
      ) : (
        <>
          <article className="bunker-v2-private-fragment">
            <span>ВАШ ФРАГМЕНТ</span>
            <h2>{model.privateFragment.label}</h2>
            <p>{model.privateFragment.body}</p>
            <strong>{model.fragmentShared ? 'ФРАГМЕНТ УЖЕ В ОБЩЕМ ПРОТОКОЛЕ' : 'ФРАГМЕНТ ПЕРЕДАЁТСЯ АВТОМАТИЧЕСКИ'}</strong>
          </article>
          <section aria-label="Выбор протокола">
            <h2>ВЫБЕРИТЕ ОДИН ПРОТОКОЛ</h2>
            <div className="bunker-v2-protocol-grid">
              {model.options.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={!model.viewer.canVote || busy || !onVote}
                  className={localVote === option.key ? 'is-selected' : ''}
                  aria-pressed={localVote === option.key}
                  onClick={() => void castVote(option.key)}
                  aria-label={`ПРОТОКОЛ ${option.key} · ${option.summary}`}
                >
                  <span>{option.title}</span>
                  <strong>{option.summary}</strong>
                  {localVote === option.key && <small>ВЫБРАНО ВАМИ</small>}
                </button>
              ))}
            </div>
            {model.viewer.canVote ? (
              <>
                {localVote && (
                  <p className="bunker-v2-mission__answer-status" role="status" aria-label="Состояние вашего голоса">
                    <strong>{authoritativeAccepted ? `Ответ принят: протокол ${localVote}.` : `Вы выбрали протокол ${localVote}.`}</strong>
                    <span>{authoritativeAccepted ? 'Выбор сохранён.' : voteState === 'sending' ? 'Голос отправляется…' : voteState === 'error' ? 'Голос не отправлен. Выберите протокол ещё раз.' : 'Голос отправлен. Ждём подтверждение сервера.'}</span>
                  </p>
                )}
              </>
            ) : (
              <p>Вы присоединились после фиксации состава. Обсуждайте решение с вагоном; голосуют участники замороженного состава.</p>
            )}
          </section>
          <details className="bunker-v2-mission__secondary">
            <summary>ДЕТАЛИ ОБЩЕГО ПРОТОКОЛА</summary>
            <section aria-label="Общие фрагменты">
              <h2>ОБЩИЙ ПРОТОКОЛ · {model.fragmentsRevealed} / {model.fragmentsTotal}</h2>
              {model.revealedFragments.length === 0 ? (
                <p>Другие вагоны ещё не передали свои данные.</p>
              ) : (
                <div className="bunker-v2-fragments">
                  {model.revealedFragments.map((fragment) => (
                    <article key={fragment.key}><strong>{fragment.label}</strong><p>{fragment.body}</p></article>
                  ))}
                </div>
              )}
            </section>
            {model.viewer.canVote && (
              <p>{mine?.consensus ? `Ваш вагон согласовал протокол ${mine.consensus}.` : `Вашему вагону нужно ${mine?.required ?? 0} голоса для согласования.`}</p>
            )}
            {model.ability?.available && (
              <aside className="bunker-v2-mission__ability">
                <strong>ВАША СПОСОБНОСТЬ МОЖЕТ ПОМОЧЬ</strong>
                <p>{model.ability.hint}</p>
                <button type="button" disabled={busy || !onUseAbility} onClick={() => void useAction(onUseAbility)}>
                  ПРОВЕРИТЬ ПРОТОКОЛ · {model.ability.label.toLocaleUpperCase('ru-RU')}
                </button>
              </aside>
            )}
            {model.ability && !model.ability.available && <p className="bunker-v2-mission__hint">{model.ability.hint}</p>}
          </details>
        </>
      )}
    </section>
  );
}
