import { useEffect, useState } from 'react';
import type { MissionTwoAbility, MissionTwoEvidence, MissionTwoQuestion } from './m02.service';

export type MissionTwoPlayerReadModel = {
  instanceId: string; instanceVersion: number; status: 'active' | 'completed'; remainingSeconds: number;
  title: string; subtitle: string; intro: string; evidence: MissionTwoEvidence[]; questions: MissionTwoQuestion[];
  attemptCount: number; attemptsRemaining: number; selectedAnswers: string[]; connection: 'online' | 'reconnecting';
  ability: MissionTwoAbility; outcome?: 'success' | 'black_box_incomplete'; archiveUnlocked?: 'BK-17';
};

function timer(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function authoritativeAnswers(model: MissionTwoPlayerReadModel): string[] {
  return model.selectedAnswers.length === 3 ? [...model.selectedAnswers] : ['', '', ''];
}

function firstUnanswered(answers: readonly string[]): number {
  const index = answers.findIndex((answer) => !answer.trim());
  return index === -1 ? answers.length : index;
}

function guidedQuestionIndex(model: MissionTwoPlayerReadModel, answers: readonly string[]): number {
  if (model.status === 'active' && model.attemptCount > 0 && answers.every((answer) => answer.trim())) {
    return 0;
  }
  return firstUnanswered(answers);
}

export function MissionTwoPlayer({ model, onSubmit, onUseAbility }: {
  model: MissionTwoPlayerReadModel;
  onSubmit?: (answers: string[]) => Promise<void> | void;
  onUseAbility?: (ability: 'system_access' | 'terminal_hack') => Promise<void> | void;
}) {
  const [answers, setAnswers] = useState<string[]>(() => authoritativeAnswers(model));
  const [questionIndex, setQuestionIndex] = useState(() => guidedQuestionIndex(model, authoritativeAnswers(model)));
  const [hintDrawerOpen, setHintDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionState, setSubmissionState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const selectedAnswersKey = model.selectedAnswers.join('\u001f');

  useEffect(() => {
    const nextAnswers = authoritativeAnswers(model);
    setAnswers(nextAnswers);
    setQuestionIndex(guidedQuestionIndex(model, nextAnswers));
    setSubmissionState('idle');
    setError('');
  }, [model.instanceId, model.attemptCount, model.status, selectedAnswersKey]);

  const complete = answers.every((answer) => answer.trim());
  const resolved = model.status === 'completed';
  const currentQuestion = model.questions[questionIndex];
  const currentAnswer = answers[questionIndex] ?? '';
  const attemptText = model.attemptsRemaining === 1 ? 'Осталась 1 попытка.' : `Осталось попыток: ${model.attemptsRemaining}.`;

  const confirmAnswer = () => {
    if (!currentAnswer.trim()) return;
    setQuestionIndex((current) => Math.min(current + 1, model.questions.length));
  };

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
      {model.connection === 'reconnecting' && <p role="status">Связь восстанавливается. Ваши уже полученные данные остаются на экране.</p>}
      {model.archiveUnlocked && <p role="status" aria-label="Архив вагона">Архив вагона: {model.archiveUnlocked} доступен.</p>}
      {resolved ? (
        <div className="bunker-v2-mission__result" role="status">
          <h2>{model.outcome === 'success' ? 'ЧЁРНЫЙ ЯЩИК РАСШИФРОВАН' : 'ЗАПИСЬ ВОССТАНОВЛЕНА НЕ ПОЛНОСТЬЮ'}</h2>
          <p>{model.outcome === 'success' ? 'В архив вагона добавлена папка BK-17. Запомните это обозначение — оно связано с общей историей.' : 'Игра продолжается. Недостающий фрагмент можно будет восстановить позже.'}</p>
        </div>
      ) : (
        <>
          {model.attemptCount > 0 && (
            <p className="bunker-v2-mission__answer-status" role="status">
              <strong>Предыдущая версия не подошла.</strong>
              <span>Ответы сохранены для сравнения. Проверьте их заново, начиная с первого вопроса.</span>
            </p>
          )}
          {currentQuestion ? (
            <fieldset className="bunker-v2-mission__questions">
              <legend>Вопрос {questionIndex + 1} из {model.questions.length}</legend>
              <div className="bunker-v2-mission__question">
                <h2>{currentQuestion.prompt}</h2>
                {currentQuestion.options.map((option) => <label key={option} className={currentAnswer === option ? 'is-selected' : ''}>
                  <input type="radio" name={`m02-${currentQuestion.key}`} value={option} checked={currentAnswer === option} onChange={() => {
                    setSubmissionState('idle');
                    setError('');
                    setAnswers((current) => current.map((value, index) => index === questionIndex ? option : value));
                  }} />
                  <span>{option}</span>
                </label>)}
              </div>
              <button className="bunker-v2-mission__primary" type="button" disabled={!currentAnswer.trim()} onClick={confirmAnswer}>Подтвердить ответ</button>
            </fieldset>
          ) : (
            <>
              <p className="bunker-v2-mission__answer-status" role="status" aria-label="Готовность ответа"><strong>Все ответы выбраны</strong><span>Теперь отправьте версию на проверку.</span></p>
              {submissionState !== 'idle' && <p className="bunker-v2-mission__answer-status" role="status" aria-label="Состояние отправки ответа"><strong>{submissionState === 'sending' ? 'Ответ отправляется…' : 'Ответ отправлен'}</strong><span>{submissionState === 'sending' ? 'Не закрывайте страницу.' : 'Ждём результат проверки с сервера.'}</span></p>}
              {error && <p className="bunker-v2-mission__error" role="alert">{error}</p>}
              <button className="bunker-v2-mission__primary" type="button" disabled={!complete || busy || !onSubmit} onClick={() => void submit()}>{submissionState === 'sending' ? 'ОТПРАВЛЯЕМ…' : 'ПРОВЕРИТЬ ВЕРСИЮ'}</button>
            </>
          )}
          <section className="bunker-v2-mission__evidence" aria-label="Фрагменты чёрного ящика">
            <button type="button" aria-expanded={hintDrawerOpen} aria-controls="mission-two-hints" onClick={() => setHintDrawerOpen((open) => !open)}>{hintDrawerOpen ? 'Закрыть подсказки' : 'Открыть подсказки'}</button>
            {hintDrawerOpen && <div id="mission-two-hints" role="region" aria-label="Подсказки из чёрного ящика"><h2>ПОДСКАЗКИ ИЗ ЧЁРНОГО ЯЩИКА</h2><ul>{model.evidence.map((entry) => <li key={entry.key}><strong>{entry.label}</strong><span>{entry.body}</span></li>)}</ul></div>}
          </section>
          <details className="bunker-v2-mission__secondary">
            <summary>ДОПОЛНИТЕЛЬНО</summary>
            <p className="bunker-v2-mission__attempts" role="status">{attemptText}</p>
            {model.ability?.available && <aside className="bunker-v2-mission__ability"><strong>ВАША СПОСОБНОСТЬ МОЖЕТ ПОМОЧЬ</strong><p>{model.ability.hint}</p><button type="button" disabled={busy} onClick={() => { setBusy(true); Promise.resolve(onUseAbility?.(model.ability!.key)).finally(() => setBusy(false)); }}>ИСПОЛЬЗОВАТЬ СПОСОБНОСТЬ · {model.ability.label.toLocaleUpperCase('ru-RU')}</button></aside>}
          </details>
        </>
      )}
    </section>
  );
}
