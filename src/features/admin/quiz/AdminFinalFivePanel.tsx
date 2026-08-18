import { useEffect, useMemo, useState } from 'react';
import type {
  ActivateQuizQuestionResult,
  AdminQuizControl,
  RevealQuizResultsResult,
} from '../../quiz/adminQuiz.service';
import type {
  FinalFiveRole,
  IssuedFinalFiveRoleAccess,
  OwnerFinalFiveStatus,
  RevealFinalFiveResult,
  SeedFinalFiveResult,
} from '../../quiz/finalFive.service';

export type AdminFinalFivePanelDependencies = {
  loadQuiz: (eventId: string) => Promise<AdminQuizControl>;
  seed: (eventId: string) => Promise<SeedFinalFiveResult>;
  issueRole: (eventId: string, role: FinalFiveRole) => Promise<IssuedFinalFiveRoleAccess>;
  buildRoleUrl: (role: FinalFiveRole, token: string) => string;
  activate: (eventId: string, questionId: string) => Promise<ActivateQuizQuestionResult>;
  revealGuestResults: (eventId: string, questionId: string) => Promise<RevealQuizResultsResult>;
  loadStatus: (eventId: string, questionId: string) => Promise<OwnerFinalFiveStatus>;
  revealFinal: (eventId: string, questionId: string) => Promise<RevealFinalFiveResult>;
  broadcastRefresh: () => Promise<void>;
};

type Props = {
  eventId: string;
  dependencies: AdminFinalFivePanelDependencies;
};

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function AdminFinalFivePanel({ eventId, dependencies }: Props) {
  const deps = useMemo(() => dependencies, [dependencies]);
  const [control, setControl] = useState<AdminQuizControl | null>(null);
  const [status, setStatus] = useState<OwnerFinalFiveStatus | null>(null);
  const [roleUrls, setRoleUrls] = useState<Partial<Record<FinalFiveRole, string>>>({});
  const [issuingRole, setIssuingRole] = useState<FinalFiveRole | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const reload = async () => {
    const next = await deps.loadQuiz(eventId);
    setControl(next);
    const current = next.currentQuestionId
      ? next.questions.find((question) => question.id === next.currentQuestionId && question.questionType === 'final_five')
      : null;
    if (current) {
      try {
        setStatus(await deps.loadStatus(eventId, current.id));
      } catch {
        setStatus({ status: 'not_ready' });
      }
    } else {
      setStatus(null);
    }
    return next;
  };

  useEffect(() => {
    let active = true;
    setError('');
    void deps.loadQuiz(eventId)
      .then(async (next) => {
        if (!active) return;
        setControl(next);
        const current = next.currentQuestionId
          ? next.questions.find((question) => question.id === next.currentQuestionId && question.questionType === 'final_five')
          : null;
        if (current) {
          try {
            const nextStatus = await deps.loadStatus(eventId, current.id);
            if (active) setStatus(nextStatus);
          } catch {
            if (active) setStatus({ status: 'not_ready' });
          }
        }
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить финальную пятёрку.');
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
      setError('Не удалось добавить финальную пятёрку.');
    } finally {
      setBusy('');
    }
  };

  const issueRole = async (role: FinalFiveRole) => {
    setIssuingRole(role);
    setError('');
    try {
      const issued = await deps.issueRole(eventId, role);
      setRoleUrls((current) => ({
        ...current,
        [role]: deps.buildRoleUrl(role, issued.token),
      }));
    } catch {
      setError(`Не удалось выдать ссылку для ${role === 'liza' ? 'Лизы' : 'Виктора'}.`);
    } finally {
      setIssuingRole(null);
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
      setError('Не удалось запустить финальный вопрос.');
    } finally {
      setBusy('');
    }
  };

  const revealGuests = async () => {
    if (!control?.currentQuestionId || control.phase !== 'voting') return;
    setBusy('guest-results');
    setError('');
    try {
      await deps.revealGuestResults(eventId, control.currentQuestionId);
      await deps.broadcastRefresh();
      await reload();
    } catch {
      setError('Не удалось показать результат гостей.');
    } finally {
      setBusy('');
    }
  };

  const revealFinal = async () => {
    if (!control?.currentQuestionId || control.phase !== 'results' || status?.status !== 'ok') return;
    if (!status.lizaAnswered || !status.viktorAnswered || status.revealed) return;
    setBusy('final-reveal');
    setError('');
    try {
      await deps.revealFinal(eventId, control.currentQuestionId);
      await deps.broadcastRefresh();
      setStatus({ ...status, revealed: true });
    } catch {
      setError('Не удалось раскрыть ответы Лизы и Виктора.');
    } finally {
      setBusy('');
    }
  };

  if (!control) {
    return (
      <section className="admin-final-five-panel" aria-live="polite">
        <p className="eyebrow">ФИНАЛЬНЫЙ РАУНД</p>
        <h2>ФИНАЛЬНАЯ ПЯТЁРКА</h2>
        <p>ЗАГРУЖАЕМ…</p>
      </section>
    );
  }

  const questions = control.questions.filter((question) => question.questionType === 'final_five' && question.enabled);
  const currentQuestion = control.currentQuestionId
    ? questions.find((question) => question.id === control.currentQuestionId) ?? null
    : null;
  const remainingQuestions = questions.filter((question) => question.id !== currentQuestion?.id);
  const ownerStatus = status?.status === 'ok' ? status : null;

  return (
    <section className="admin-final-five-panel" aria-label="Финальная пятёрка">
      <div className="admin-quiz-heading">
        <div>
          <p className="eyebrow">LIVE · ЛИЗА И ВИКТОР ОТВЕЧАЮТ ОТДЕЛЬНО</p>
          <h2>ФИНАЛЬНАЯ ПЯТЁРКА</h2>
        </div>
        <strong>{questions.length} / 5 ВОПРОСОВ</strong>
      </div>

      <div className="admin-final-five-role-links">
        {(['liza', 'viktor'] as FinalFiveRole[]).map((role) => (
          <div key={role} className="admin-final-five-role-link">
            <button
              type="button"
              className="registration-secondary"
              disabled={issuingRole === role}
              onClick={() => void issueRole(role)}
            >
              {issuingRole === role
                ? 'ВЫДАЁМ…'
                : role === 'liza' ? 'ССЫЛКА ДЛЯ ЛИЗЫ' : 'ССЫЛКА ДЛЯ ВИКТОРА'}
            </button>
            {roleUrls[role] && (
              <input
                readOnly
                aria-label={`Персональная ссылка ${role === 'liza' ? 'Лизы' : 'Виктора'}`}
                value={roleUrls[role]}
                onFocus={(event) => event.currentTarget.select()}
              />
            )}
          </div>
        ))}
      </div>
      <p className="admin-couple-preanswers-note">Ссылка показывается только после выдачи/перевыдачи в текущей сессии. Ответ второго человека по ней недоступен.</p>

      {questions.length === 0 ? (
        <button
          type="button"
          className="registration-submit"
          disabled={busy === 'seed'}
          onClick={() => void seed()}
        >
          {busy === 'seed' ? 'ДОБАВЛЯЕМ…' : 'ДОБАВИТЬ ФИНАЛЬНУЮ ПЯТЁРКУ'}
        </button>
      ) : (
        <>
          {currentQuestion && (
            <div className="admin-quiz-current admin-final-five-current">
              <p className="eyebrow">ТЕКУЩИЙ ФИНАЛЬНЫЙ ВОПРОС</p>
              <strong>{currentQuestion.text}</strong>
              <p>{ownerStatus?.answeredCount ?? control.answeredCount} ГОСТЕЙ ОТВЕТИЛИ</p>

              {ownerStatus && (
                <div className="admin-final-five-answer-flags">
                  <strong>{ownerStatus.lizaAnswered ? 'ЛИЗА ОТВЕТИЛА' : 'ЛИЗА · ЖДЁМ'}</strong>
                  <strong>{ownerStatus.viktorAnswered ? 'ВИКТОР ОТВЕТИЛ' : 'ВИКТОР · ЖДЁМ'}</strong>
                </div>
              )}

              {control.phase === 'voting' && (
                <button
                  type="button"
                  className="registration-submit"
                  disabled={busy === 'guest-results'}
                  onClick={() => void revealGuests()}
                >
                  {busy === 'guest-results' ? 'ОТКРЫВАЕМ…' : 'ПОКАЗАТЬ РЕЗУЛЬТАТ ГОСТЕЙ'}
                </button>
              )}

              {control.phase === 'results' && (
                <>
                  <div className="admin-quiz-results" aria-label="Результаты финального голосования">
                    <strong>ЛИЗА {percentage(control.results.liza, control.results.total)}%</strong>
                    <strong>ВИКТОР {percentage(control.results.viktor, control.results.total)}%</strong>
                  </div>

                  {ownerStatus?.revealed ? (
                    <strong className="admin-quiz-couple-revealed">ФИНАЛ РАСКРЫТ</strong>
                  ) : ownerStatus?.lizaAnswered && ownerStatus?.viktorAnswered ? (
                    <button
                      type="button"
                      className="registration-submit"
                      disabled={busy === 'final-reveal'}
                      onClick={() => void revealFinal()}
                    >
                      {busy === 'final-reveal' ? 'ОТКРЫВАЕМ…' : 'ПОКАЗАТЬ ЛИЗУ И ВИКТОРА'}
                    </button>
                  ) : (
                    <p>Ждём оба личных ответа перед финальным показом.</p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="admin-quiz-question-list" aria-label="Пять финальных вопросов">
            {remainingQuestions.map((question) => (
              <article key={question.id} className="admin-quiz-question-row">
                <div>
                  <span className="admin-quiz-number">{question.sortOrder - 100}</span>
                  <span>{question.text}</span>
                </div>
                <button
                  type="button"
                  className="registration-secondary"
                  disabled={busy.length > 0}
                  aria-label={`ЗАПУСТИТЬ ФИНАЛ: ${question.text}`}
                  onClick={() => void activate(question.id)}
                >
                  {busy === `activate:${question.id}` ? 'ЗАПУСК…' : 'ЗАПУСТИТЬ'}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
