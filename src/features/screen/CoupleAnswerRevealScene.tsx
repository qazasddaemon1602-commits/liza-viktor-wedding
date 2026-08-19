type CoupleAnswerRevealSceneProps = {
  question: string;
  choice: 'liza' | 'viktor';
  results: {
    liza: number;
    viktor: number;
    total: number;
  };
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function CoupleAnswerRevealScene({
  question,
  choice,
  results,
}: CoupleAnswerRevealSceneProps) {
  const lizaPercent = percentage(results.liza, results.total);
  const viktorPercent = percentage(results.viktor, results.total);
  const tied = results.liza === results.viktor;
  const guestMajority = tied ? null : results.liza > results.viktor ? 'liza' : 'viktor';
  const verdict = tied
    ? 'ГОСТИ НЕ ОПРЕДЕЛИЛИСЬ'
    : guestMajority === choice
      ? 'ГОСТИ УГАДАЛИ'
      : 'А ВОТ И НЕТ';
  const choiceLabel = choice === 'liza' ? 'ЛИЗА' : 'ВИКТОР';

  return (
    <section className="couple-answer-reveal-scene couple-answer-reveal-scene--editorial" aria-live="polite">
      <div className="couple-answer-reveal-frame" data-testid="couple-editorial-reveal">
        <div className="couple-answer-reveal-meta" aria-hidden="true">
          <span>OFFICIAL COUPLE ANSWER</span>
          <span>L × V · 30 AUG 2026</span>
        </div>

        <p className="eyebrow">ОТВЕТ ЛИЗЫ И ВИКТОРА</p>
        <p className="couple-answer-reveal-question">{question}</p>

        <div className="couple-answer-reveal-choice">
          <span>ОНИ ВЫБРАЛИ</span>
          <h1>{choiceLabel}</h1>
          <i className="couple-answer-reveal-choice-rule" aria-hidden="true" />
        </div>

        <div className="couple-answer-reveal-results" aria-label="Результаты гостей">
          <strong>ЛИЗА {lizaPercent}%</strong>
          <span aria-hidden="true">×</span>
          <strong>ВИКТОР {viktorPercent}%</strong>
        </div>

        <strong className="couple-answer-reveal-verdict">{verdict}</strong>

        <div className="couple-answer-reveal-stamp" aria-hidden="true">
          <span>LV</span>
          <i>✦</i>
          <span>TRUE ANSWER</span>
        </div>

        <div className="couple-answer-reveal-footer" aria-hidden="true">
          <span>LOVE RAILWAY</span>
          <i />
          <span>COUPLE ARCHIVE / 2026</span>
        </div>
      </div>
    </section>
  );
}
