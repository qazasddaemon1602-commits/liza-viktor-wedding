import { useEffect, useMemo, useState } from 'react';
import type {
  ActivateQuizQuestionResult,
  AdminQuizControl,
  RevealQuizResultsResult,
  SeedQuizQuestionsResult,
} from '../../quiz/adminQuiz.service';

export type AdminQuizPanelDependencies = {
  load: (eventId: string) => Promise<AdminQuizControl>;
  seed: (eventId: string) => Promise<SeedQuizQuestionsResult>;
  activate: (eventId: string, questionId: string) => Promise<ActivateQuizQuestionResult>;
  reveal: (eventId: string, questionId: string) => Promise<RevealQuizResultsResult>;
  broadcastRefresh: () => Promise<void>;
};

type AdminQuizPanelProps = {
  eventId: string;
  dependencies: AdminQuizPanelDependencies;
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function AdminQuizPanel({ eventId, dependencies }: AdminQuizPanelProps) {
  const deps = useMemo(() => dependencies, [dependencies]);
  const [control, setControl] = useState<AdminQuizControl | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const reload = async () => {
    const next = await deps.load(eventId);
    setControl(next);
    return next;
  };

  useEffect(() => {
    let active = true;
    setError('');
    void deps.load(eventId)
      .then((next) => {
        if (active) setControl(next);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить управление викториной.');
      });
    return () => {
      active = false;
    };
  }, [deps, eventId]);

  const seed = async () => {
    setBusy('seed');
    setError('');
    try {
      await deps.seed(eventId);
      await reload();
    } catch {
      setError('Не удалось добавить вопросы.');
    } finally {
      setBusy('');
    }
  };

  const activate = async (questionId: string) => {
    setBusy(`activate:${questionId}`);
    setError('');
    try {
      await deps.activate(eventId, questionId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось запустить вопрос.');
    } finally {
      setBusy('');
    }
  };

  const reveal = async () => {
    if (!control?.currentQuestionId || control.phase !== 'voting') return;
    setBusy('reveal');
    setError('');
    try {
      await deps.reveal(eventId, control.currentQuestionId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось показать результат.');
    } finally {
      setBusy('');
    }
  };

  if (error && !control) {
    return (
      <section className="admin-quiz-panel" aria-label="Управление викториной">
        <p className="eyebrow">LIVE QUIZ</p>
        <h2>ЛИЗА ИЛИ ВИКТОР?</h2>
        <p role="alert">{error}</p>
      </section>
    );
  }

  if (!control) {
    return (
      <section className="admin-quiz-panel" aria-label="Управление викториной" aria-live="polite">
        <p className="eyebrow">LIVE QUIZ</p>
        <h2>ЛИЗА ИЛИ ВИКТОР?</h2>
        <p>ЗАГРУЖАЕМ ВОПРОСЫ…</p>
      </section>
    );
  }

  const currentQuestion = control.currentQuestionId
    ? control.questions.find((question) => question.id === control.currentQuestionId) ?? null
    : null;
  const availableQuestions = control.questions.filter(
    (question) => question.enabled && question.id !== control.currentQuestionId,
  );

  const lizaPercent = control.phase === 'results'
    ? percentage(control.results.liza, control.results.total)
    : null;
  const viktorPercent = control.phase === 'results'
    ? percentage(control.results.viktor, control.results.total)
    : null;

  return (
    <section className="admin-quiz-panel" aria-label="Управление викториной">
      <div className="admin-quiz-heading">
        <div>
          <p className="eyebrow">LIVE QUIZ</p>
          <h2>ЛИЗА ИЛИ ВИКТОР?</h2>
        </div>
        <span className={`admin-quiz-phase admin-quiz-phase-${control.phase}`}>
          {control.phase === 'idle' ? 'ОЖИДАНИЕ' : control.phase === 'voting' ? 'ГОЛОСОВАНИЕ' : 'РЕЗУЛЬТАТ'}
        </span>
      </div>

      {control.questions.length === 0 ? (
        <div className="admin-quiz-empty">
          <p>Пул вопросов пока пуст.</p>
          <button
            type="button"
            className="registration-submit"
            disabled={busy === 'seed'}
            onClick={() => void seed()}
          >
            {busy === 'seed' ? 'ДОБАВЛЯЕМ…' : 'ДОБАВИТЬ 30 ВОПРОСОВ'}
          </button>
        </div>
      ) : (
        <>
          {currentQuestion && (
            <div className="admin-quiz-current">
              <p className="eyebrow">ТЕКУЩИЙ ВОПРОС</p>
              <strong>{currentQuestion.text}</strong>
              <p>{control.answeredCount} ответили</p>

              {control.phase === 'voting' && (
                <button
                  type="button"
                  className="registration-submit"
                  disabled={busy === 'reveal'}
                  onClick={() => void reveal()}
                >
                  {busy === 'reveal' ? 'ОТКРЫВАЕМ…' : 'ПОКАЗАТЬ РЕЗУЛЬТАТ'}
                </button>
              )}

              {control.phase === 'results' && (
                <div className="admin-quiz-results" aria-label="Результаты голосования">
                  <strong>ЛИЗА {lizaPercent}%</strong>
                  <strong>ВИКТОР {viktorPercent}%</strong>
                </div>
              )}
            </div>
          )}

          <div className="admin-quiz-question-list" aria-label="Вопросы викторины">
            {availableQuestions.map((question) => (
              <article key={question.id} className="admin-quiz-question-row">
                <div>
                  <span className="admin-quiz-number">{String(question.sortOrder).padStart(2, '0')}</span>
                  <span>{question.text}</span>
                </div>
                <button
                  type="button"
                  className="registration-secondary"
                  aria-label={`ЗАПУСТИТЬ: ${question.text}`}
                  disabled={busy.length > 0}
                  onClick={() => void activate(question.id)}
                >
                  {busy === `activate:${question.id}` ? 'ЗАПУСК…' : 'ЗАПУСТИТЬ'}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {error && <p className="admin-quiz-error" role="alert">{error}</p>}
    </section>
  );
}
