import { useEffect, useState } from 'react';
import type { MissionTwoAbility, MissionTwoEvidence, MissionTwoQuestion } from './m02.service';

export type MissionTwoPlayerReadModel = {
  instanceId: string; instanceVersion: number; status: 'active' | 'completed'; remainingSeconds: number;
  title: string; subtitle: string; intro: string; evidence: MissionTwoEvidence[]; questions: MissionTwoQuestion[];
  attemptCount: number; attemptsRemaining: number; selectedAnswers: string[]; connection: 'online' | 'reconnecting';
  ability: MissionTwoAbility; outcome?: 'success' | 'black_box_incomplete'; archiveUnlocked?: 'BK-17';
};

function timer(seconds: number) { const safe = Math.max(0, Math.floor(seconds)); return `${String(Math.floor(safe / 60)).padStart(2,'0')}:${String(safe % 60).padStart(2,'0')}`; }

function authoritativeAnswers(model: MissionTwoPlayerReadModel): string[] {
  return model.selectedAnswers.length === 3 ? [...model.selectedAnswers] : ['', '', ''];
}

export function MissionTwoPlayer({ model, onSubmit, onUseAbility }: { model: MissionTwoPlayerReadModel; onSubmit?: (answers: string[]) => Promise<void> | void; onUseAbility?: (ability: 'system_access' | 'terminal_hack') => Promise<void> | void }) {
  const [answers, setAnswers] = useState<string[]>(() => authoritativeAnswers(model));
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissionState, setSubmissionState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const selectedAnswersKey = model.selectedAnswers.join('\u001f');
  useEffect(() => {
    setAnswers(authoritativeAnswers(model));
    setSubmissionState('idle');
    setError('');
  }, [model.instanceId, model.instanceVersion, model.attemptCount, model.status, selectedAnswersKey]);
  const complete = answers.every((answer) => answer.trim());
  const answeredCount = answers.filter((answer) => answer.trim()).length;
  const resolved = model.status === 'completed';
  const attemptText = model.attemptsRemaining === 1 ? 'Осталась 1 попытка.' : `Осталось попыток: ${model.attemptsRemaining}.`;
  const submit = async () => {
    if (!onSubmit || !complete || busy) return;
    setBusy(true);
    setSubmissionState('sending');
    setError('');
    try {
      await onSubmit([...answers]);
      setSubmissionState('sent');
    } catch {
      setSubmissionState('idle');
      setError('Ответ не отправлен. Проверьте связь и нажмите «Проверить версию» ещё раз.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="bunker-v2-mission bunker-v2-mission--m02" aria-label="Задание 2 · Чёрный ящик">
      <header className="bunker-v2-mission__header"><div><span>ЗАДАНИЕ 2</span><h1>{model.title}</h1><p>{model.subtitle}</p></div><time aria-label="До конца задания">{timer(model.remainingSeconds)}</time></header>
      <p className="bunker-v2-mission__intro">{model.intro}</p>
      <section className="bunker-v2-mission__next-step" aria-label="Что делать сейчас">
        <strong>ЧТО ДЕЛАТЬ СЕЙЧАС</strong>
        <ol>
          <li>Откройте все фрагменты и сравните данные.</li>
          <li>Выберите по одному ответу в каждом из трёх вопросов.</li>
          <li>Когда появится «Все ответы выбраны», нажмите «Проверить версию».</li>
        </ol>
      </section>
      {model.connection === 'reconnecting' && <p role="status">Связь восстанавливается. Ваши уже полученные данные остаются на экране.</p>}
      {resolved ? (
        <div className="bunker-v2-mission__result" role="status">
          <h2>{model.outcome === 'success' ? 'ЧЁРНЫЙ ЯЩИК РАСШИФРОВАН' : 'ЗАПИСЬ ВОССТАНОВЛЕНА НЕ ПОЛНОСТЬЮ'}</h2>
          <p>{model.outcome === 'success' ? 'В архив вагона добавлена папка BK-17. Запомните это обозначение — оно связано с общей историей.' : 'Игра продолжается. Недостающий фрагмент можно будет восстановить позже.'}</p>
        </div>
      ) : (
        <>
          <fieldset className="bunker-v2-mission__questions"><legend>Ответьте на три вопроса</legend>{model.questions.map((question, questionIndex) => <div key={question.key} className="bunker-v2-mission__question"><h2>{question.prompt}</h2>{question.options.map((option) => <label key={option} className={answers[questionIndex] === option ? 'is-selected' : ''}><input type="radio" name={`m02-${question.key}`} value={option} checked={answers[questionIndex] === option} onChange={() => { setSubmissionState('idle'); setError(''); setAnswers((current) => current.map((value, index) => index === questionIndex ? option : value)); }} /> <span>{option}</span></label>)}</div>)}</fieldset>
          <section className="bunker-v2-mission__evidence" aria-label="Фрагменты чёрного ящика"><h2>ШЕСТЬ ВОССТАНОВЛЕННЫХ ФРАГМЕНТОВ</h2><div className="bunker-v2-mission__evidence-grid">{model.evidence.map((entry) => <article key={entry.key}><button type="button" aria-expanded={openEvidence === entry.key} onClick={() => setOpenEvidence((current) => current === entry.key ? null : entry.key)}>{entry.label}</button>{openEvidence === entry.key && <p>{entry.body}</p>}</article>)}</div></section>
          {model.ability?.available && <aside className="bunker-v2-mission__ability"><strong>ВАША СПОСОБНОСТЬ МОЖЕТ ПОМОЧЬ</strong><p>{model.ability.hint}</p><button type="button" disabled={busy} onClick={() => { setBusy(true); Promise.resolve(onUseAbility?.(model.ability!.key)).finally(() => setBusy(false)); }}>ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ · {model.ability.label.toLocaleUpperCase('ru-RU')}</button></aside>}
          <p className="bunker-v2-mission__answer-status" role="status" aria-label="Готовность ответа">
            <strong>{complete ? 'Все ответы выбраны' : `Вы ответили: ${answeredCount} из 3`}</strong>
            <span>{complete ? 'Теперь нажмите кнопку ниже.' : 'Выбор сохранится на этом телефоне.'}</span>
          </p>
          <p className="bunker-v2-mission__attempts" role="status">{attemptText}</p>
          {submissionState !== 'idle' && <p className="bunker-v2-mission__answer-status" role="status" aria-label="Состояние отправки ответа"><strong>{submissionState === 'sending' ? 'Ответ отправляется…' : 'Ответ отправлен'}</strong><span>{submissionState === 'sending' ? 'Не закрывайте страницу.' : 'Ждём результат проверки с сервера.'}</span></p>}
          {error && <p className="bunker-v2-mission__error" role="alert">{error}</p>}
          <button className="bunker-v2-mission__primary" type="button" disabled={!complete || busy || !onSubmit} onClick={() => void submit()}>{submissionState === 'sending' ? 'ОТПРАВЛЯЕМ…' : 'ПРОВЕРИТЬ ВЕРСИЮ'}</button>
        </>
      )}
    </section>
  );
}
