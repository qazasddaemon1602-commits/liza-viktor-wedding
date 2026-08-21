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
    <section className="final-five-reveal-scene final-five-reveal-scene--editorial" aria-live="polite">
      <div className="final-five-reveal-frame" data-testid="final-five-editorial-spread">
        <div className="final-five-reveal-meta" aria-hidden="true">
          <span>PRIVATE EDITION · FINAL FIVE</span>
          <span>L × V · CONFIDENTIAL ANSWERS</span>
        </div>

        <p className="eyebrow">ФИНАЛЬНАЯ ПЯТЁРКА</p>
        <h1>{state.question.text}</h1>

        <div className="final-five-reveal-guest-results" aria-label="Результаты гостей">
          <strong>ЛИЗА {lizaPercent}%</strong>
          <span aria-hidden="true">×</span>
          <strong>ВИКТОР {viktorPercent}%</strong>
        </div>

        <div className="final-five-reveal-private-answers">
          {stage >= 1 && (
            <div className="final-five-reveal-answer final-five-reveal-answer--liza">
              <span>ОТВЕТ ЛИЗЫ</span>
              <strong className="final-five-reveal-answer-value">{label(state.lizaAnswer)}</strong>
              <small aria-hidden="true">PRIVATE CARD · 01</small>
            </div>
          )}
          {stage >= 2 && (
            <div className="final-five-reveal-answer final-five-reveal-answer--viktor">
              <span>ОТВЕТ ВИКТОРА</span>
              <strong className="final-five-reveal-answer-value">{label(state.viktorAnswer)}</strong>
              <small aria-hidden="true">PRIVATE CARD · 02</small>
            </div>
          )}
        </div>

        {stage >= 3 && <strong className="final-five-reveal-verdict">{verdict}</strong>}

        <div className="final-five-reveal-seal" aria-hidden="true">
          <span>LV</span>
          <i>✦</i>
          <span>30·08·26</span>
        </div>

        <div className="final-five-reveal-footer" aria-hidden="true">
          <span>WEDDING ARCHIVE</span>
          <i />
          <span>FINAL FIVE · LOVE RAILWAY</span>
        </div>
      </div>
    </section>
  );
}

