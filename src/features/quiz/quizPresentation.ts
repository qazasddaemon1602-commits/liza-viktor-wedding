export type QuizPresentationPhase = 'voting' | 'results';
export type QuizAnnouncementStatus =
  | 'open'
  | 'submitting'
  | 'accepted'
  | 'locked'
  | 'results'
  | 'error';

export const quizPresentationKey = (questionId: string, phase: QuizPresentationPhase): string =>
  `${questionId}:${phase}`;

export const quizAnnouncementKey = (
  questionId: string,
  phase: QuizPresentationPhase,
  status: QuizAnnouncementStatus,
): string => `${questionId}:${phase}:${status}`;
