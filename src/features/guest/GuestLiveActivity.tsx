import type { BunkerMissionStage, GuestBunkerQuestState } from '../bunker/bunkerQuest.types';
import { GuestBunkerQuest } from '../bunker/GuestBunkerQuest';
import type { GuestCarriageCall } from '../carriages/carriageCalls.service';
import type { CarriageSummary } from '../registration/registration.types';
import { GuestLiveQuizCard } from '../quiz/GuestLiveQuizCard';
import type { GuestQuizState, QuizChoice } from '../quiz/quiz.service';
import { GuestCallBanner } from './GuestCallBanner';

type GuestLiveActivityProps = {
  carriage: CarriageSummary;
  activeCall: GuestCarriageCall | null;
  bunkerState?: GuestBunkerQuestState | null;
  bunkerFeedback?: string;
  bunkerSubmitting?: boolean;
  onBunkerMission?: (stage: BunkerMissionStage, answer: string) => void;
  onBunkerFinalCode?: (code: string) => void;
  quizState: GuestQuizState | null;
  quizError?: string;
  quizSubmitting?: QuizChoice | null;
  onQuizVote: (choice: QuizChoice) => void;
  onQuizDeadline?: () => void;
};

export function GuestLiveActivity({
  carriage,
  activeCall,
  bunkerState = null,
  bunkerFeedback = '',
  bunkerSubmitting = false,
  onBunkerMission = () => undefined,
  onBunkerFinalCode = () => undefined,
  quizState,
  quizError = '',
  quizSubmitting = null,
  onQuizVote,
  onQuizDeadline,
}: GuestLiveActivityProps) {
  if (bunkerState?.status === 'active') {
    return (
      <div className="guest-live-activity guest-live-activity--bunker">
        <GuestBunkerQuest
          state={bunkerState}
          submitting={bunkerSubmitting}
          feedback={bunkerFeedback}
          onMission={onBunkerMission}
          onFinalCode={onBunkerFinalCode}
        />
      </div>
    );
  }

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
      <p>Когда начнётся Бункер, Live Quiz или ваш вагон вызовут, нужная карточка появится здесь автоматически.</p>
      {quizError && <p className="guest-hub-notice" role="status">{quizError}</p>}
    </div>
  );
}
