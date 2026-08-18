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
    <section className="couple-answer-reveal-scene" aria-live="polite">
      <div className="couple-answer-reveal-frame">
        <p className="eyebrow">ОТВЕТ ЛИЗЫ И ВИКТОРА</p>
        <p className="couple-answer-reveal-question">{question}</p>

        <div className="couple-answer-reveal-choice">
          <span>ОНИ ВЫБРАЛИ</span>
          <h1>{choiceLabel}</h1>
        </div>

        <div className="couple-answer-reveal-results" aria-label="Результаты гостей">
          <strong>ЛИЗА {lizaPercent}%</strong>
          <span aria-hidden="true">×</span>
          <strong>ВИКТОР {viktorPercent}%</strong>
        </div>

        <strong className="couple-answer-reveal-verdict">{verdict}</strong>
      </div>
    </section>
  );
}
