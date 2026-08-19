import type { AdminQuizHistoryEntry } from '../../quiz/adminQuiz.service';

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

type AdminQuizHistoryProps = {
  history?: AdminQuizHistoryEntry[];
};

export function AdminQuizHistory({ history = [] }: AdminQuizHistoryProps) {
  const standardHistory = history.filter((entry) => entry.questionType === 'standard');

  return (
    <section className="admin-quiz-history" aria-label="Пройденные вопросы">
      <div className="admin-quiz-history__heading">
        <div>
          <p className="eyebrow">ПРОЙДЕННЫЕ ВОПРОСЫ</p>
          <h3>КРАТКАЯ ИСТОРИЯ</h3>
        </div>
        <strong>{standardHistory.length}</strong>
      </div>

      {standardHistory.length === 0 ? (
        <p className="admin-quiz-history__empty">После закрытия вопросов здесь появятся результаты.</p>
      ) : (
        <div className="admin-quiz-history__list">
          {standardHistory.map((entry, index) => (
            <article key={entry.roundId}>
              <span>{String(standardHistory.length - index).padStart(2, '0')}</span>
              <div>
                <strong>{entry.questionText}</strong>
                <small>{entry.answeredCount} ОТВЕТИЛИ</small>
              </div>
              <div className="admin-quiz-history__result">
                <b>Л {percentage(entry.results.liza, entry.results.total)}%</b>
                <b>В {percentage(entry.results.viktor, entry.results.total)}%</b>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
