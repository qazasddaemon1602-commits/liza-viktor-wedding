import { useEffect, useState } from 'react';
import { bunkerItemLabel } from './labels';
import type { MissionThreeAbility, MissionThreeCommitment, MissionThreeInventoryItem, MissionThreeProblem } from './m03.service';

export type MissionThreePlayerReadModel = {
  instanceId: string;
  instanceVersion: number;
  status: 'active' | 'completed';
  remainingSeconds: number;
  title: string;
  intro: string;
  memberRole: 'captain' | 'member';
  problems: MissionThreeProblem[];
  inventory: MissionThreeInventoryItem[];
  selectedProblems: string[];
  ability: MissionThreeAbility;
  pendingCommitments: MissionThreeCommitment[];
  connection: 'online' | 'reconnecting';
  outcome?: Record<string, unknown>;
};

function timer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function MissionThreePlayer({ model, onConfirm, onUseAbility }: {
  model: MissionThreePlayerReadModel;
  onConfirm?: (keys: string[]) => Promise<void> | void;
  onUseAbility?: (problemKey: string) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<string[]>(model.selectedProblems);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const selectedProblemsKey = model.selectedProblems.join('\u001f');
  useEffect(() => {
    setSelected(model.selectedProblems);
    setBusy(false);
    setActionError('');
  }, [model.instanceId, model.instanceVersion, selectedProblemsKey]);

  const captain = model.memberRole === 'captain';
  const hasUsableItem = (itemKey: string) => model.inventory.some((item) => (
    item.itemKey === itemKey && item.status === 'available' && item.quantity > 0
  ));
  const toggle = (key: string) => setSelected((current) => (
    current.includes(key) ? current.filter((entry) => entry !== key) : current.length < 3 ? [...current, key] : current
  ));
  const useAbility = async () => {
    if (!model.ability?.available || !onUseAbility || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await onUseAbility(model.ability.problemKey);
    } catch {
      setActionError('Способность не применена. Проверьте связь и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (!onConfirm || selected.length === 0 || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await onConfirm([...selected]);
    } catch {
      setActionError('Не удалось подтвердить распределение. Проверьте связь и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bunker-v2-mission bunker-v2-mission--m03" aria-label="Задание 3 · Аварийный запас">
      <header className="bunker-v2-mission__header"><div><span>ЗАДАНИЕ 3</span><h1>{model.title}</h1></div><time>{timer(model.remainingSeconds)}</time></header>
      <p className="bunker-v2-mission__intro">{model.intro}</p>
      {model.connection === 'reconnecting' && <p role="status">Связь восстанавливается. Последнее решение и запас сохранены.</p>}
      <section aria-label="Запас вагона"><h2>ЧТО ЕСТЬ В ВАГОНЕ</h2><div className="bunker-v2-inventory">{model.inventory.map((item) => <article key={item.itemKey}><strong>{bunkerItemLabel(item.itemKey).toLocaleUpperCase('ru-RU')}</strong><span>× {item.quantity}</span></article>)}</div></section>
      {model.status === 'completed' ? (
        <div role="status"><h2>РАСПРЕДЕЛЕНИЕ ЗАФИКСИРОВАНО</h2><p>Последствия сохранены. Неиспользованные предметы остаются в вагоне и могут пригодиться дальше.</p></div>
      ) : (
        <>
          {!captain && <p role="status" aria-label="Ожидание решения капитана">Обсудите приоритеты с вагоном. Капитан вагона подтвердит общее распределение.</p>}
          <section aria-label="Проблемы вагона">
            <h2>{captain ? 'ВЫБЕРИТЕ ДО ТРЁХ ПРОБЛЕМ' : 'ОБСУДИТЕ ТРИ ПРИОРИТЕТА С КАПИТАНОМ'}</h2>
            <div className="bunker-v2-problems">
              {model.problems.map((problem) => {
                const selectedProblem = selected.includes(problem.key);
                const available = hasUsableItem(problem.itemKey);
                const description = <span><strong>{problem.title}</strong><small>{problem.risk}</small><em>Подходит: {bunkerItemLabel(problem.itemKey)}</em>{!available && <small>Недоступно: требуется {bunkerItemLabel(problem.itemKey).toLocaleLowerCase('ru-RU')}.</small>}</span>;
                if (!captain) {
                  return <article key={problem.key} className={selectedProblem ? 'is-selected' : ''}>{description}</article>;
                }
                const disabled = !available || (!selectedProblem && selected.length >= 3);
                return <label key={problem.key} className={selectedProblem ? 'is-selected' : ''}>
                  <input type="checkbox" checked={selectedProblem} disabled={disabled} onChange={() => toggle(problem.key)} />
                  {description}
                </label>;
              })}
            </div>
          </section>
          {actionError && <p className="bunker-v2-mission__error" role="alert">{actionError}</p>}
          {captain && <button className="bunker-v2-mission__primary" type="button" disabled={selected.length === 0 || busy || !onConfirm} onClick={() => void confirm()}>ПОДТВЕРДИТЬ РАСПРЕДЕЛЕНИЕ</button>}
          {(model.ability?.available || model.pendingCommitments.length > 0) && (
            <details className="bunker-v2-mission__secondary">
              <summary>ДОПОЛНИТЕЛЬНО</summary>
              {model.ability?.available && <aside className="bunker-v2-mission__ability"><strong>ВАША СПОСОБНОСТЬ МОЖЕТ ПОМОЧЬ</strong><p>{model.ability.label} — для проблемы «{model.problems.find((problem) => problem.key === model.ability?.problemKey)?.title}».</p><button type="button" disabled={busy || !onUseAbility} onClick={() => void useAbility()}>ПРИМЕНИТЬ МОЮ СПОСОБНОСТЬ</button></aside>}
              {model.pendingCommitments.length > 0 && <p role="status">Предложено способностей: {model.pendingCommitments.filter((commitment) => commitment.status === 'pending').length}. Они будут потрачены только если капитан выберет соответствующую проблему.</p>}
            </details>
          )}
        </>
      )}
    </section>
  );
}
