import type { QuizScreenState } from '../quiz/quizScreen.service';

type ActiveQuizScreenState = Extract<QuizScreenState, { status: 'active' }>;

type QuizScreenSceneProps = {
  state: ActiveQuizScreenState;
  expectedGuestCount?: number;
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function QuizScreenScene({
  state,
  expectedGuestCount = 40,
}: QuizScreenSceneProps) {
  const answeredLabel = `${state.answeredCount} / ${expectedGuestCount} ОТВЕТИЛИ`;
  const lizaPercent = state.phase === 'results'
    ? percentage(state.results.liza, state.results.total)
    : null;
  const viktorPercent = state.phase === 'results'
    ? percentage(state.results.viktor, state.results.total)
    : null;

  return (
    <section className={`quiz-screen-scene quiz-screen-scene-${state.phase}`} aria-live="polite">
      <div className="quiz-screen-frame">
        <header className="quiz-screen-header">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <span className="quiz-screen-counter">{answeredLabel}</span>
        </header>

        <div className="quiz-screen-question-wrap">
          <h1>{state.question.text}</h1>
          {state.question.imagePath && (
            <img
              className="quiz-screen-question-image"
              src={state.question.imagePath}
              alt=""
              role="presentation"
            />
          )}
        </div>

        {state.phase === 'voting' ? (
          <div className="quiz-screen-voting-hint" aria-hidden="true">
            <span>ЛИЗА</span>
            <span>ИЛИ</span>
            <span>ВИКТОР</span>
          </div>
        ) : (
          <div className="quiz-screen-results" aria-label="Результаты голосования">
            <div className="quiz-screen-result quiz-screen-result-liza">
              <span>ЛИЗА</span>
              <strong>{lizaPercent}%</strong>
            </div>
            <div className="quiz-screen-result-divider" aria-hidden="true">×</div>
            <div className="quiz-screen-result quiz-screen-result-viktor">
              <span>ВИКТОР</span>
              <strong>{viktorPercent}%</strong>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
