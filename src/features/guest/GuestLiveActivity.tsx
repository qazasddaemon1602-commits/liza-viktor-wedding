import type { GuestCarriageCall } from '../carriages/carriageCalls.service';
import type { CarriageSummary } from '../registration/registration.types';
import { GuestLiveQuizCard } from '../quiz/GuestLiveQuizCard';
import type { GuestQuizState, QuizChoice } from '../quiz/quiz.service';
import { GuestCallBanner } from './GuestCallBanner';

type GuestLiveActivityProps = {
  carriage: CarriageSummary;
  activeCall: GuestCarriageCall | null;
  quizState: GuestQuizState | null;
  quizError?: string;
  quizSubmitting?: QuizChoice | null;
  onQuizVote: (choice: QuizChoice) => void;
  onQuizDeadline?: () => void;
};

export function GuestLiveActivity({
  carriage,
  activeCall,
  quizState,
  quizError = '',
  quizSubmitting = null,
  onQuizVote,
  onQuizDeadline,
}: GuestLiveActivityProps) {
  if (activeCall) {
    return (
      <div className="guest-live-activity guest-live-activity--urgent">
        <GuestCallBanner carriage={carriage} call={activeCall} />
      </div>
    );
  }

  if (quizState?.status === 'active') {
    return (
      <div className="guest-live-activity guest-live-activity--quiz">
        <GuestLiveQuizCard
          state={quizState}
          compact
          submitting={quizSubmitting}
          error={quizError}
          onVote={onQuizVote}
          onDeadline={onQuizDeadline}
        />
      </div>
    );
  }

  return (
    <div className="guest-live-activity guest-live-activity--idle" aria-live="polite">
      <p className="eyebrow">СЕЙЧАС ПРОИСХОДИТ</p>
      <strong>ОЖИДАЕМ СЛЕДУЮЩЕЕ СОБЫТИЕ</strong>
      <p>Когда начнётся Live Quiz или ваш вагон вызовут, нужная карточка появится здесь автоматически.</p>
      {quizError && <p className="guest-hub-notice" role="status">{quizError}</p>}
    </div>
  );
}
