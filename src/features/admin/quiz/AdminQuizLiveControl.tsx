import type { AdminQuizControl, AdminQuizQuestion } from '../../quiz/adminQuiz.service';
import { QuizPhaseTimer } from '../../quiz/QuizPhaseTimer';
import { quizAnnouncementKey, quizPresentationKey } from '../../quiz/quizPresentation';
import { SceneTransition } from '../../screen/SceneTransition';

type ActiveAdminQuizControl = Extract<AdminQuizControl, { phase: 'voting' | 'results' }>;

type AdminQuizLiveControlProps = {
  control: ActiveAdminQuizControl;
  question: AdminQuizQuestion;
  busy: string;
  hasNext: boolean;
  onReveal: () => void;
  onClose: () => void;
  onNext: () => void;
  onReturnMain: () => void;
  onDeadline: () => void;
};

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function AdminQuizLiveControl({
  control,
  question,
  busy,
  hasNext,
  onReveal,
  onClose,
  onNext,
  onReturnMain,
  onDeadline,
}: AdminQuizLiveControlProps) {
  const lizaPercent = control.phase === 'results'
    ? percentage(control.results.liza, control.results.total)
    : null;
  const viktorPercent = control.phase === 'results'
    ? percentage(control.results.viktor, control.results.total)
    : null;

  return (
    <SceneTransition
      sceneKey={quizPresentationKey(question.id, control.phase)}
      label={control.phase === 'voting' ? 'НОВЫЙ ВОПРОС' : 'РЕЗУЛЬТАТЫ'}
      tone={control.phase === 'voting' ? 'sage' : 'wine'}
      className="admin-quiz-live-transition"
    >
    <div className="admin-quiz-current admin-quiz-live-control">
      <div className="admin-quiz-live-control__top">
        <div>
          <p className="eyebrow">ТЕКУЩИЙ ВОПРОС</p>
          <strong>{question.text}</strong>
          <p>{control.answeredCount} ОТВЕТИЛИ</p>
        </div>
        <div className="admin-quiz-live-control__timer">
          <span>{control.phase === 'voting' ? 'ОТВЕТЫ' : 'РЕЗУЛЬТАТЫ'}</span>
          <QuizPhaseTimer endsAt={control.phaseEndsAt} onExpire={onDeadline} />
        </div>
      </div>

      <p
        className="admin-quiz-live-control__status"
        role="status"
        aria-atomic="true"
        data-announcement-key={quizAnnouncementKey(
          question.id,
          control.phase,
          control.phase === 'voting' ? 'open' : 'results',
        )}
      >
        {control.phase === 'voting' ? 'ВОПРОС ОТКРЫТ · ГОСТИ ВЫБИРАЮТ ОТВЕТ' : 'РЕЗУЛЬТАТЫ ОТКРЫТЫ'}
      </p>

      {control.phase === 'results' && (
        <div className="admin-quiz-results" aria-label="Результаты голосования">
          <strong>ЛИЗА {lizaPercent}%</strong>
          <strong>ВИКТОР {viktorPercent}%</strong>
        </div>
      )}

      <div className="admin-quiz-live-control__actions">
        {control.phase === 'voting' ? (
          <button
            type="button"
            className="registration-submit"
            disabled={Boolean(busy)}
            onClick={onReveal}
          >
            {busy === 'reveal' ? 'ЗАКРЫВАЕМ…' : 'ЗАКРЫТЬ ОТВЕТЫ СЕЙЧАС'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="registration-submit"
              disabled={Boolean(busy)}
              onClick={onClose}
            >
              {busy === 'close' ? 'ЗАКРЫВАЕМ…' : 'ЗАКРЫТЬ ВОПРОС'}
            </button>
            {hasNext && (
              <button
                type="button"
                className="registration-secondary"
                disabled={Boolean(busy)}
                onClick={onNext}
              >
                {busy === 'next' ? 'ЗАПУСКАЕМ…' : 'СЛЕДУЮЩИЙ ВОПРОС'}
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className="registration-secondary admin-quiz-return-main"
          disabled={Boolean(busy) || control.presentOnMainScreen === false}
          onClick={onReturnMain}
        >
          {control.presentOnMainScreen === false ? 'ТВ УЖЕ НА ОСНОВНОМ ЭКРАНЕ' : 'ВЕРНУТЬ ОСНОВНОЙ ЭКРАН'}
        </button>
      </div>
    </div>
    </SceneTransition>
  );
}

