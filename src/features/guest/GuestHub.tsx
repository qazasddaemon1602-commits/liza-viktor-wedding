import type { GuestCarriageCall } from '../carriages/carriageCalls.service';
import type { RegisteredGuest } from '../registration/registration.types';
import { VirtualTicket } from '../registration/VirtualTicket';
import type { GuestQuizState, QuizChoice, QuizHistoryEntry } from '../quiz/quiz.service';
import { GuestLiveActivity } from './GuestLiveActivity';

type GuestHubProps = {
  guest: RegisteredGuest;
  activeCall: GuestCarriageCall | null;
  quizState: GuestQuizState | null;
  quizError?: string;
  quizSubmitting?: QuizChoice | null;
  onQuizVote: (choice: QuizChoice) => void;
  onQuizDeadline?: () => void;
};

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function historyFrom(state: GuestQuizState | null): QuizHistoryEntry[] {
  if (!state || !('history' in state) || !state.history) return [];
  return state.history;
}

export function GuestHub({
  guest,
  activeCall,
  quizState,
  quizError = '',
  quizSubmitting = null,
  onQuizVote,
  onQuizDeadline,
}: GuestHubProps) {
  const history = historyFrom(quizState);
  const quizStatus = quizState?.status === 'active'
    ? quizState.phase === 'voting' ? 'ИДЁТ ГОЛОСОВАНИЕ' : 'ПОКАЗЫВАЕМ РЕЗУЛЬТАТ'
    : 'ОЖИДАЕМ ВОПРОС';

  return (
    <main className="guest-hub">
      <header className="guest-hub-header">
        <div>
          <p className="eyebrow">ЛИЗА × ВИКТОР · 30.08.2026</p>
          <h1>ВАШ ВЕЧЕР</h1>
          <p>{guest.firstName}, держите эту страницу открытой — активности будут появляться здесь сами.</p>
        </div>
        <span className="guest-hub-online">LIVE</span>
      </header>

      <section className="guest-hub-section guest-hub-ticket" aria-label="Мой билет">
        <div className="guest-hub-section-heading">
          <p className="eyebrow">МОЙ БИЛЕТ</p>
        </div>
        <VirtualTicket guest={guest} />
      </section>

      <section className="guest-hub-section guest-hub-now" aria-label="Сейчас происходит">
        <div className="guest-hub-section-heading">
          <p className="eyebrow">СЕЙЧАС ПРОИСХОДИТ</p>
          <span>ОБНОВЛЯЕТСЯ АВТОМАТИЧЕСКИ</span>
        </div>
        <GuestLiveActivity
          carriage={guest.carriage}
          activeCall={activeCall}
          quizState={quizState}
          quizError={quizError}
          quizSubmitting={quizSubmitting}
          onQuizVote={onQuizVote}
          onQuizDeadline={onQuizDeadline}
        />
      </section>

      <section className="guest-hub-section" aria-label="Мои активности">
        <div className="guest-hub-section-heading">
          <p className="eyebrow">МОИ АКТИВНОСТИ</p>
        </div>
        <div className="guest-hub-activity-grid">
          <article>
            <span>LIVE QUIZ</span>
            <strong>{quizStatus}</strong>
            <p>Вопрос появится здесь автоматически — переходить на отдельную страницу не нужно.</p>
          </article>
          <a
            className="guest-hub-activity-link guest-event-action--mk"
            href="/mortal-kombat"
            aria-label="MORTAL KOMBAT · УЧАСТВОВАТЬ"
          >
            <span>MORTAL KOMBAT</span>
            <strong>ОТКРЫТЬ АРЕНУ</strong>
            <p>Регистрация и статус турнира. После проверки вернитесь сюда.</p>
          </a>
        </div>
      </section>

      <section className="guest-hub-section guest-hub-history" aria-label="История вечера">
        <div className="guest-hub-section-heading">
          <p className="eyebrow">ИСТОРИЯ ВЕЧЕРА</p>
          <span>{history.length} ЗАВЕРШЕНО</span>
        </div>
        {history.length === 0 ? (
          <p className="guest-hub-empty">Здесь появятся уже завершённые вопросы и события.</p>
        ) : (
          <div className="guest-hub-history-list">
            {history.slice(0, 8).map((entry) => (
              <article key={entry.roundId}>
                <div>
                  <span>LIVE QUIZ</span>
                  <strong>{entry.questionText}</strong>
                </div>
                <div className="guest-hub-history-result">
                  <span>Л {percentage(entry.results.liza, entry.results.total)}%</span>
                  <span>В {percentage(entry.results.viktor, entry.results.total)}%</span>
                  {entry.selectedChoice && (
                    <small>ВАШ ОТВЕТ · {entry.selectedChoice === 'liza' ? 'ЛИЗА' : 'ВИКТОР'}</small>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
