import { useEffect, useMemo, useState } from 'react';
import type {
  ActivateQuizQuestionResult,
  AdminQuizControl,
  CloseQuizRoundResult,
  RevealQuizResultsResult,
  ReturnQuizMainResult,
  SeedQuizQuestionsResult,
} from '../../quiz/adminQuiz.service';
import type {
  OwnerCoupleRevealStatus,
  RevealOwnerCoupleAnswerResult,
} from '../../quiz/coupleReveal.service';
import { AdminQuizHistory } from './AdminQuizHistory';
import { AdminQuizLiveControl } from './AdminQuizLiveControl';

export type AdminQuizPanelDependencies = {
  load: (eventId: string) => Promise<AdminQuizControl>;
  seed: (eventId: string) => Promise<SeedQuizQuestionsResult>;
  activate: (eventId: string, questionId: string) => Promise<ActivateQuizQuestionResult>;
  reveal: (eventId: string, questionId: string) => Promise<RevealQuizResultsResult>;
  close: (eventId: string) => Promise<CloseQuizRoundResult>;
  returnMain: (eventId: string) => Promise<ReturnQuizMainResult>;
  broadcastRefresh: () => Promise<void>;
  loadCoupleRevealStatus?: (eventId: string, questionId: string) => Promise<OwnerCoupleRevealStatus>;
  revealCoupleAnswer?: (eventId: string, questionId: string) => Promise<RevealOwnerCoupleAnswerResult>;
};

type AdminQuizPanelProps = {
  eventId: string;
  dependencies: AdminQuizPanelDependencies;
};

export function AdminQuizPanel({ eventId, dependencies }: AdminQuizPanelProps) {
  const deps = useMemo(() => dependencies, [dependencies]);
  const [control, setControl] = useState<AdminQuizControl | null>(null);
  const [coupleRevealStatus, setCoupleRevealStatus] = useState<OwnerCoupleRevealStatus | null>(null);
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

  useEffect(() => {
    let active = true;
    const current = control?.currentQuestionId
      ? control.questions.find((question) => question.id === control.currentQuestionId)
      : null;
    if (
      control?.phase !== 'results'
      || !current
      || current.questionType !== 'standard'
      || !deps.loadCoupleRevealStatus
    ) {
      setCoupleRevealStatus(null);
      return () => { active = false; };
    }

    void deps.loadCoupleRevealStatus(eventId, current.id)
      .then((next) => {
        if (active) setCoupleRevealStatus(next);
      })
      .catch(() => {
        if (active) setCoupleRevealStatus({ status: 'not_ready', revealed: false });
      });

    return () => { active = false; };
  }, [control, deps, eventId]);

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
    setCoupleRevealStatus(null);
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
    const current = control.questions.find((question) => question.id === control.currentQuestionId);
    if (!current || current.questionType !== 'standard') return;
    setBusy('reveal');
    setError('');
    try {
      await deps.reveal(eventId, control.currentQuestionId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось закрыть ответы и показать результат.');
    } finally {
      setBusy('');
    }
  };

  const close = async () => {
    setBusy('close');
    setError('');
    try {
      await deps.close(eventId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось закрыть текущий вопрос.');
    } finally {
      setBusy('');
    }
  };

  const next = async (questionId: string) => {
    setBusy('next');
    setError('');
    setCoupleRevealStatus(null);
    try {
      await deps.close(eventId);
      await deps.activate(eventId, questionId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось запустить следующий вопрос.');
    } finally {
      setBusy('');
    }
  };

  const returnMain = async () => {
    setBusy('return-main');
    setError('');
    try {
      await deps.returnMain(eventId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось вернуть ТВ на основной экран.');
    } finally {
      setBusy('');
    }
  };

  const deadline = async () => {
    try {
      await reload();
      await deps.broadcastRefresh();
    } catch {
      setError('Не удалось обновить фазу по таймеру. Нажмите действие вручную.');
    }
  };

  const revealCoupleAnswer = async () => {
    if (
      !control?.currentQuestionId
      || control.phase !== 'results'
      || coupleRevealStatus?.status !== 'ready'
      || !deps.revealCoupleAnswer
    ) return;

    setBusy('reveal-couple');
    setError('');
    try {
      await deps.revealCoupleAnswer(eventId, control.currentQuestionId);
      await deps.broadcastRefresh();
      setCoupleRevealStatus({ status: 'revealed', revealed: true });
    } catch {
      setError('Не удалось показать ответ Лизы и Виктора.');
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

  const standardQuestions = control.questions.filter((question) => question.questionType === 'standard');
  const completedIds = new Set(
    (control.history ?? [])
      .filter((entry) => entry.questionType === 'standard')
      .map((entry) => entry.questionId),
  );
  const currentQuestion = control.currentQuestionId
    ? standardQuestions.find((question) => question.id === control.currentQuestionId) ?? null
    : null;
  const availableQuestions = standardQuestions.filter(
    (question) => question.enabled
      && question.id !== control.currentQuestionId
      && !completedIds.has(question.id),
  );
  const nextQuestion = currentQuestion
    ? availableQuestions
      .filter((question) => question.sortOrder > currentQuestion.sortOrder)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? availableQuestions.sort((a, b) => a.sortOrder - b.sortOrder)[0]
    : availableQuestions.sort((a, b) => a.sortOrder - b.sortOrder)[0];

  return (
    <section className="admin-quiz-panel" aria-label="Управление викториной">
      <div className="admin-quiz-heading">
        <div>
          <p className="eyebrow">LIVE QUIZ · 30 СЕК + 30 СЕК</p>
          <h2>ЛИЗА ИЛИ ВИКТОР?</h2>
        </div>
        <span className={`admin-quiz-phase admin-quiz-phase-${currentQuestion ? control.phase : 'idle'}`}>
          {!currentQuestion || control.phase === 'idle' ? 'ОЖИДАНИЕ' : control.phase === 'voting' ? 'ГОЛОСОВАНИЕ' : 'РЕЗУЛЬТАТ'}
        </span>
      </div>

      {standardQuestions.length === 0 ? (
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
          {currentQuestion && (control.phase === 'voting' || control.phase === 'results') && (
            <>
              <AdminQuizLiveControl
                control={control}
                question={currentQuestion}
                busy={busy}
                hasNext={Boolean(nextQuestion)}
                onReveal={() => void reveal()}
                onClose={() => void close()}
                onNext={() => { if (nextQuestion) void next(nextQuestion.id); }}
                onReturnMain={() => void returnMain()}
                onDeadline={() => void deadline()}
              />

              {control.phase === 'results' && coupleRevealStatus?.status === 'ready' && deps.revealCoupleAnswer && (
                <button
                  type="button"
                  className="registration-submit admin-quiz-couple-action"
                  disabled={busy === 'reveal-couple'}
                  onClick={() => void revealCoupleAnswer()}
                >
                  {busy === 'reveal-couple' ? 'ОТКРЫВАЕМ…' : 'ПОКАЗАТЬ ОТВЕТ ЛИЗЫ И ВИКТОРА'}
                </button>
              )}

              {control.phase === 'results' && coupleRevealStatus?.status === 'revealed' && (
                <strong className="admin-quiz-couple-revealed">ОТВЕТ ПАРЫ ПОКАЗАН</strong>
              )}

              {control.phase === 'results' && coupleRevealStatus?.status === 'not_ready' && (
                <p className="admin-quiz-couple-not-ready">Совместный ответ для этого вопроса ещё не готов к показу.</p>
              )}
            </>
          )}

          <div className="admin-quiz-question-list" aria-label="Оставшиеся вопросы викторины">
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

      <AdminQuizHistory history={control.history} />
      {error && <p className="admin-quiz-error" role="alert">{error}</p>}
    </section>
  );
}
