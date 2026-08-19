import { useEffect } from 'react';
import { siteAudio } from '../../lib/siteAudio';
import type { GuestQuizState, QuizChoice } from './quiz.service';
import { QuizPhaseTimer } from './QuizPhaseTimer';

type ActiveGuestQuizState = Extract<GuestQuizState, { status: 'active' }>;

type GuestLiveQuizCardProps = {
  state: ActiveGuestQuizState;
  submitting?: QuizChoice | null;
  error?: string;
  onVote: (choice: QuizChoice) => void;
  onDeadline?: () => void;
  compact?: boolean;
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function GuestLiveQuizCard({
  state,
  submitting = null,
  error = '',
  onVote,
  onDeadline,
  compact = false,
}: GuestLiveQuizCardProps) {
  const locked = state.phase === 'results' || Boolean(state.selectedChoice) || Boolean(submitting);
  const lizaPercent = state.phase === 'results' ? percentage(state.results.liza, state.results.total) : null;
  const viktorPercent = state.phase === 'results' ? percentage(state.results.viktor, state.results.total) : null;

  useEffect(() => {
    if (state.phase === 'results') siteAudio.play('reveal');
  }, [state.phase, state.question.id]);

  useEffect(() => {
    if (error) siteAudio.play('error');
  }, [error]);

  return (
    <section className={`quiz-live-card guest-live-quiz-card${compact ? ' guest-live-quiz-card--compact' : ''}`} aria-live="polite">
      <header className="quiz-heading">
        <div className="quiz-live-meta">
          <p className="eyebrow">LIVE QUIZ · ЛИЗА ИЛИ ВИКТОР?</p>
          <QuizPhaseTimer endsAt={state.phaseEndsAt} onExpire={onDeadline} />
        </div>
        <h1>{state.question.text}</h1>
        <p className="quiz-answered">{state.answeredCount} ответили</p>
      </header>

      {state.question.imagePath && (
        <img className="quiz-question-image" src={state.question.imagePath} alt="" />
      )}

      <div className="quiz-choices" aria-label="Варианты ответа">
        <button
          type="button"
          data-audio-cue="select"
          className={`quiz-choice quiz-choice-liza${state.selectedChoice === 'liza' ? ' is-selected' : ''}`}
          disabled={locked}
          onClick={() => onVote('liza')}
        >
          <span>ЛИЗА</span>
          {lizaPercent !== null && <strong>{lizaPercent}%</strong>}
        </button>
        <button
          type="button"
          data-audio-cue="select"
          className={`quiz-choice quiz-choice-viktor${state.selectedChoice === 'viktor' ? ' is-selected' : ''}`}
          disabled={locked}
          onClick={() => onVote('viktor')}
        >
          <span>ВИКТОР</span>
          {viktorPercent !== null && <strong>{viktorPercent}%</strong>}
        </button>
      </div>

      {submitting && <p className="quiz-status">ФИКСИРУЕМ ОТВЕТ…</p>}
      {!submitting && state.phase === 'voting' && state.selectedChoice && (
        <p className="quiz-status">ОТВЕТ ПРИНЯТ</p>
      )}
      {state.phase === 'voting' && !state.selectedChoice && !submitting && (
        <p className="quiz-status quiz-status-open">ВЫБЕРИТЕ ОТВЕТ ДО КОНЦА ТАЙМЕРА</p>
      )}
      {state.phase === 'results' && (
        <p className="quiz-status quiz-status-results">РЕЗУЛЬТАТЫ · СЛЕДУЮЩИЙ ЭТАП СКОРО</p>
      )}
      {error && <p className="quiz-error" role="alert">{error}</p>}
    </section>
  );
}
