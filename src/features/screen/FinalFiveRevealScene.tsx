import { useEffect, useState } from 'react';
import type { RevealedFinalFive } from '../quiz/finalFive.service';

type FinalFiveRevealSceneProps = {
  state: Extract<RevealedFinalFive, { status: 'revealed' }>;
  stepMs?: number;
};

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function label(choice: 'liza' | 'viktor'): string {
  return choice === 'liza' ? 'ЛИЗА' : 'ВИКТОР';
}

export function FinalFiveRevealScene({ state, stepMs = 1500 }: FinalFiveRevealSceneProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
    const first = window.setTimeout(() => setStage(1), stepMs);
    const second = window.setTimeout(() => setStage(2), stepMs * 2);
    const third = window.setTimeout(() => setStage(3), stepMs * 3);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      window.clearTimeout(third);
    };
  }, [state.question.id, stepMs]);

  const lizaPercent = percentage(state.results.liza, state.results.total);
  const viktorPercent = percentage(state.results.viktor, state.results.total);
  const verdict = state.lizaAnswer === state.viktorAnswer
    ? 'СОВПАЛИ. НЕВЕРОЯТНО.'
    : 'СЕМЕЙНАЯ ДИСКУССИЯ ОФИЦИАЛЬНО ОТКРЫТА.';

  return (
    <section className="final-five-reveal-scene" aria-live="polite">
      <div className="final-five-reveal-frame">
        <p className="eyebrow">ФИНАЛЬНАЯ ПЯТЁРКА</p>
        <h1>{state.question.text}</h1>

        <div className="final-five-reveal-guest-results" aria-label="Результаты гостей">
          <strong>ЛИЗА {lizaPercent}%</strong>
          <span aria-hidden="true">×</span>
          <strong>ВИКТОР {viktorPercent}%</strong>
        </div>

        <div className="final-five-reveal-private-answers">
          {stage >= 1 && (
            <div className="final-five-reveal-answer">
              <span>ОТВЕТ ЛИЗЫ</span>
              <strong className="final-five-reveal-answer-value">{label(state.lizaAnswer)}</strong>
            </div>
          )}
          {stage >= 2 && (
            <div className="final-five-reveal-answer">
              <span>ОТВЕТ ВИКТОРА</span>
              <strong className="final-five-reveal-answer-value">{label(state.viktorAnswer)}</strong>
            </div>
          )}
        </div>

        {stage >= 3 && <strong className="final-five-reveal-verdict">{verdict}</strong>}
      </div>
    </section>
  );
}
