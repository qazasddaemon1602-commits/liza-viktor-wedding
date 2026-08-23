import { useEffect } from 'react';
import { QuizPhaseTimer } from '../quiz/QuizPhaseTimer';
import type { QuizScreenState } from '../quiz/quizScreen.service';
import { SceneTransition } from './SceneTransition';

type ActiveQuizScreenState = Extract<QuizScreenState, { status: 'active' }>;

type QuizScreenSceneProps = {
  state: ActiveQuizScreenState;
  expectedGuestCount?: number;
  onSignal?: (phase: ActiveQuizScreenState['phase']) => void;
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function toAvifQuizImagePath(imagePath: string): string | null {
  const suffixIndex = imagePath.search(/[?#]/);
  const pathname = suffixIndex === -1 ? imagePath : imagePath.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : imagePath.slice(suffixIndex);
  if (!pathname.toLowerCase().endsWith('.webp')) return null;
  return `${pathname.slice(0, -'.webp'.length)}.avif${suffix}`;
}

export function QuizScreenScene({
  state,
  expectedGuestCount = 40,
  onSignal,
}: QuizScreenSceneProps) {
  useEffect(() => {
    onSignal?.(state.phase);
  }, [onSignal, state.phase, state.question.id]);
  const answeredLabel = `${state.answeredCount} / ${expectedGuestCount} ОТВЕТИЛИ`;
  const lizaPercent = state.phase === 'results'
    ? percentage(state.results.liza, state.results.total)
    : null;
  const viktorPercent = state.phase === 'results'
    ? percentage(state.results.viktor, state.results.total)
    : null;
  const avifImagePath = state.question.imagePath
    ? toAvifQuizImagePath(state.question.imagePath)
    : null;

  return (
    <SceneTransition
      sceneKey={`${state.question.id}-${state.phase}`}
      label={state.phase === 'voting' ? 'НОВЫЙ ВОПРОС' : 'РЕЗУЛЬТАТЫ'}
      tone={state.phase === 'voting' ? 'sage' : 'wine'}
    >
      <section className={`quiz-screen-scene quiz-screen-scene-${state.phase} quiz-screen-scene--editorial`} aria-live="polite">
      <div className="quiz-screen-frame" data-testid="quiz-editorial-spread">
        <div className="quiz-screen-editorial-meta" aria-hidden="true">
          <span>WEDDING EDITION · LV</span>
          <span>30 AUG 2026</span>
        </div>

        <header className="quiz-screen-header">
          <p className="eyebrow">ЛИЗА ИЛИ ВИКТОР?</p>
          <div className="quiz-screen-header__status">
            <QuizPhaseTimer endsAt={state.phaseEndsAt} className="quiz-screen-timer" />
            <span className="quiz-screen-counter">{answeredLabel}</span>
          </div>
        </header>

        <div className="quiz-screen-question-wrap">
          <div className="quiz-screen-question-copy">
            <div className="quiz-screen-route-mark" data-testid="quiz-route-mark" aria-hidden="true">
              <span>L</span>
              <i />
              <span>V</span>
            </div>
            <h1>{state.question.text}</h1>
            <p className="quiz-screen-question-note" aria-hidden="true">
              {state.phase === 'voting' ? '30 SECONDS · CHOOSE NOW' : 'RESULTS · 30 SECONDS'}
            </p>
          </div>
          {state.question.imagePath && (
            <div className="quiz-screen-image-frame">
              <picture>
                {avifImagePath && (
                  <source srcSet={avifImagePath} type="image/avif" />
                )}
                <img
                  className="quiz-screen-question-image"
                  src={state.question.imagePath}
                  alt=""
                  role="presentation"
                />
              </picture>
              <span aria-hidden="true">ARCHIVE / L×V</span>
            </div>
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

        <div className="quiz-screen-editorial-footer" aria-hidden="true">
          <span>ONE STORY</span>
          <i />
          <span>FIVE CARRIAGES</span>
          <i />
          <span>L × V</span>
        </div>
      </div>
      </section>
    </SceneTransition>
  );
}

