import { useEffect, useMemo, useState } from 'react';
import { bunkerItemLabel, bunkerStatusLabel } from './labels';
import type { MissionFourGuestReadModel } from './m04.service';

type ActiveMissionFour = Extract<MissionFourGuestReadModel, { status: 'active' | 'completed' }>;

export type MissionFourPlayerReadModel = {
  instanceId: string;
  status: 'active' | 'completed';
  remainingSeconds: number;
  title: string;
  interactionPhase: 'exchange' | 'answer' | 'resolved';
  group: ActiveMissionFour['group'];
  viewer: ActiveMissionFour['viewer'];
  messageQuota: number;
  messagesRemaining: number;
  messages: ActiveMissionFour['messages'];
  inventory: ActiveMissionFour['inventory'];
  trades: ActiveMissionFour['trades'];
  answer: ActiveMissionFour['answer'];
  ability: ActiveMissionFour['ability'];
  connection: 'online' | 'reconnecting';
};

const PREPARED_MESSAGES = [
  'Сектор 04 найден. Сверьте данные.',
  'Тоннель 04 подтверждён. Держим связь.',
  'Маршрут к сектору 04 готов. Передайте ответ.',
] as const;

function timer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function hasPreparedMessage(model: MissionFourPlayerReadModel): boolean {
  const viewerLabel = model.group.wagons.find((wagon) => wagon.id === model.viewer.wagonId)?.label;
  return Boolean(viewerLabel && model.messages.some((entry) => (
    entry.fromWagonLabel === viewerLabel
    && (PREPARED_MESSAGES as readonly string[]).includes(entry.message)
  )));
}

export function MissionFourPlayer({
  model,
  onSend,
  onProposeTrade,
  onRespondTrade,
  onAnswer,
}: {
  model: MissionFourPlayerReadModel;
  onSend?: (message: string) => Promise<void> | void;
  onProposeTrade?: (input: { targetWagonNumber: number; itemKey: string; quantity: number }) => Promise<void> | void;
  onRespondTrade?: (id: string, response: 'accept' | 'reject') => Promise<void> | void;
  onAnswer?: (answer: string) => Promise<void> | void;
}) {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState(model.answer.selected ?? '');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [preparedMessageSent, setPreparedMessageSent] = useState(() => hasPreparedMessage(model));
  const targets = model.group.wagons.filter((wagon) => wagon.id !== model.viewer.wagonId);
  const items = model.inventory.filter((entry) => entry.quantity > 0);
  const [target, setTarget] = useState(targets[0]?.number ?? 0);
  const [item, setItem] = useState(items[0]?.itemKey ?? '');
  const inbound = useMemo(
    () => model.trades.filter((trade) => trade.direction === 'incoming' && trade.status === 'proposed'),
    [model.trades],
  );
  const messagesKey = model.messages.map((entry) => `${entry.id}:${entry.message}`).join('\u001f');

  useEffect(() => {
    setPreparedMessageSent(hasPreparedMessage(model));
    setActionError('');
    setBusy(false);
  }, [model.instanceId]);

  useEffect(() => {
    if (hasPreparedMessage(model)) setPreparedMessageSent(true);
  }, [messagesKey, model.viewer.wagonId]);

  const runAction = async (action: () => Promise<void> | void, recovery: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setActionError('');
    try {
      await action();
      return true;
    } catch {
      setActionError(recovery);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async (value: string, options: { clearComposer?: boolean; prepared?: boolean } = {}) => {
    if (!onSend || busy || model.messagesRemaining < 1) return;
    const sent = await runAction(
      () => onSend(value),
      'Сообщение не отправлено. Проверьте связь и попробуйте ещё раз.',
    );
    if (!sent) return;
    if (options.clearComposer) setMessage('');
    if (options.prepared) setPreparedMessageSent(true);
  };

  return (
    <section className="bunker-v2-mission bunker-v2-mission--m04" aria-label="Задание 4 · Межвагонная связь">
      <header className="bunker-v2-mission__header">
        <div><span>ЗАДАНИЕ 4</span><h1>{model.title}</h1></div>
        <time>{timer(model.remainingSeconds)}</time>
      </header>
      <p>Ваша группа: {model.group.wagons.map((wagon) => wagon.label).join(' + ')}. Связь ограничена — коротко передавайте только важное.</p>
      <p className="bunker-v2-mission__role" role="status" aria-label="Ваша роль в задании">
        <strong>{model.viewer.isOperator ? 'ВЫ — СВЯЗИСТ ВАГОНА' : 'ВЫ ПОМОГАЕТЕ ОБСУЖДАТЬ'}</strong>
        <span>{model.viewer.isOperator ? 'Выберите готовое сообщение. Дополнительные действия доступны ниже.' : 'Обсудите варианты вслух. Связист выберет и отправит общее решение вагона.'}</span>
      </p>
      {model.connection === 'reconnecting' && <p role="status">Связь с сервером восстанавливается. Уже принятые сообщения и обмены сохранены.</p>}
      {actionError && <p className="bunker-v2-mission__error" role="alert">{actionError}</p>}

      {model.interactionPhase === 'exchange' && (
        <>
          {model.viewer.isOperator && !preparedMessageSent && (
            <section aria-label="Готовые сообщения" className="bunker-v2-mission__primary-actions">
              <h2>ВЫБЕРИТЕ ГОТОВОЕ СООБЩЕНИЕ</h2>
              {PREPARED_MESSAGES.map((prepared) => (
                <button
                  key={prepared}
                  className="bunker-v2-mission__primary"
                  type="button"
                  disabled={busy || model.messagesRemaining < 1 || !onSend}
                  onClick={() => void send(prepared, { prepared: true })}
                >
                  {prepared}
                </button>
              ))}
              <small>Осталось сообщений: {model.messagesRemaining}</small>
            </section>
          )}
          {model.viewer.isOperator && preparedMessageSent && (
            <p className="bunker-v2-mission__answer-status" role="status" aria-label="Сообщение связиста">
              <strong>Сообщение отправлено.</strong>
              <span>Обсуждайте ответ с вагоном. Ждём остальные вагоны.</span>
            </p>
          )}

          <details className="bunker-v2-mission__secondary">
            <summary>ДОПОЛНИТЕЛЬНЫЕ ДЕЙСТВИЯ</summary>
            <section aria-label="Сообщения группы">
              <h2>ИСТОРИЯ СООБЩЕНИЙ</h2>
              {model.messages.length === 0 ? <p>Сообщений пока нет.</p> : (
                <ol>{model.messages.map((entry) => <li key={entry.id}><strong>{entry.fromWagonLabel} · {entry.senderName}</strong><p>{entry.message}</p></li>)}</ol>
              )}
              {model.viewer.isOperator && (
                <div className="bunker-v2-message-composer">
                  <label>Сообщение соседнему вагону<textarea aria-label="Сообщение соседнему вагону" maxLength={120} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
                  <span>{message.length} / 120</span>
                  <button type="button" disabled={!message.trim() || model.messagesRemaining < 1 || busy || !onSend} onClick={() => void send(message, { clearComposer: true })}>ОТПРАВИТЬ СВОЙ ТЕКСТ</button>
                </div>
              )}
            </section>

            {model.viewer.isOperator && targets.length > 0 && items.length > 0 && (
              <section aria-label="Обмен ресурсами">
                <h2>ПРЕДЛОЖИТЬ ОБМЕН</h2>
                <label>Кому<select value={target} onChange={(event) => setTarget(Number(event.target.value))}>{targets.map((wagon) => <option key={wagon.id} value={wagon.number}>{wagon.label}</option>)}</select></label>
                <label>Что<select value={item} onChange={(event) => setItem(event.target.value)}>{items.map((entry) => <option key={entry.itemKey} value={entry.itemKey}>{bunkerItemLabel(entry.itemKey)} · {entry.quantity} шт.</option>)}</select></label>
                <button type="button" disabled={busy || !onProposeTrade} onClick={() => {
                  if (!onProposeTrade) return;
                  void runAction(
                    () => onProposeTrade({ targetWagonNumber: target, itemKey: item, quantity: 1 }),
                    'Предложение обмена не отправлено. Проверьте связь и попробуйте ещё раз.',
                  );
                }}>ПРЕДЛОЖИТЬ 1 ПРЕДМЕТ</button>
              </section>
            )}

            {inbound.length > 0 && (
              <section aria-label="Входящие обмены">
                <h2>ВАМ ПРЕДЛАГАЮТ</h2>
                {inbound.map((trade) => <article key={trade.id}><p>{trade.otherWagonLabel}: {bunkerItemLabel(trade.itemKey)} × {trade.quantity}</p>{model.viewer.isOperator && <div><button type="button" disabled={busy || !onRespondTrade} onClick={() => {
                  if (!onRespondTrade) return;
                  void runAction(
                    () => onRespondTrade(trade.id, 'accept'),
                    'Ответ на обмен не отправлен. Проверьте связь и попробуйте ещё раз.',
                  );
                }}>ПРИНЯТЬ</button><button type="button" disabled={busy || !onRespondTrade} onClick={() => {
                  if (!onRespondTrade) return;
                  void runAction(
                    () => onRespondTrade(trade.id, 'reject'),
                    'Ответ на обмен не отправлен. Проверьте связь и попробуйте ещё раз.',
                  );
                }}>ОТКЛОНИТЬ</button></div>}</article>)}
              </section>
            )}

            <section aria-label="История обменов">
              <h2>ОБМЕНЫ</h2>
              {model.trades.length === 0 ? <p>Обменов пока нет.</p> : model.trades.map((trade) => <p key={trade.id}>{trade.direction === 'incoming' ? 'Получаем от' : 'Передаём в'} {trade.otherWagonLabel}: {bunkerItemLabel(trade.itemKey)} × {trade.quantity} · {bunkerStatusLabel(trade.status)}</p>)}
            </section>
          </details>
        </>
      )}

      {model.interactionPhase === 'answer' && (
        <section aria-label="Общий ответ группы">
          <h2>СВЕРЬТЕ ОБЩИЙ ВЫВОД</h2>
          <p>Каждый вагон выбирает один вариант. Задание завершится, когда вся группа выберет одинаково.</p>
          <fieldset><legend>Что сейчас важнее всего для группы?</legend>{model.answer.options.map((option) => <label key={option}><input type="radio" name="m04-answer" checked={answer === option} onChange={() => { setAnswer(option); setActionError(''); }} /><span>{option}</span></label>)}</fieldset>
          <p>{model.answer.answeredWagons} / {model.answer.totalWagons} вагонов уже ответили</p>
          <button className="bunker-v2-mission__primary" type="button" disabled={!answer || busy || !onAnswer} onClick={() => {
            if (!onAnswer) return;
            void runAction(
              () => onAnswer(answer),
              'Ответ не отправлен. Проверьте связь и попробуйте ещё раз.',
            );
          }}>ПОДТВЕРДИТЬ ОТВЕТ ВАГОНА</button>
        </section>
      )}
      {model.interactionPhase === 'resolved' && <div role="status"><h2>СВЯЗЬ УСТАНОВЛЕНА</h2><p>Группа согласовала общий ответ. Обмены и сообщения сохранены.</p></div>}
    </section>
  );
}
