export type QuizChoice = 'liza' | 'viktor';
export type QuizQuestionType = 'standard' | 'final_five';

export type QuizRpcError = Error | { message?: string; code?: string } | null;

export type QuizRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: QuizRpcError }>;
};

export type GuestQuizQuestion = {
  id: string;
  text: string;
  questionType: QuizQuestionType;
  imagePath: string | null;
};

export type QuizResults = {
  liza: number;
  viktor: number;
  total: number;
};

export type QuizHistoryEntry = {
  roundId: string;
  questionId: string;
  questionText: string;
  questionType: QuizQuestionType;
  closedAt: string;
  answeredCount: number;
  results: QuizResults;
  selectedChoice: QuizChoice | null;
};

type TimedProjection = {
  roundId?: string;
  phaseStartedAt?: string | null;
  phaseEndsAt?: string | null;
  history?: QuizHistoryEntry[];
};

export type GuestQuizState =
  | { status: 'not_found' }
  | { status: 'not_registered' }
  | ({ status: 'idle'; history?: QuizHistoryEntry[] })
  | (TimedProjection & {
      status: 'active';
      phase: 'voting';
      question: GuestQuizQuestion;
      selectedChoice: QuizChoice | null;
      answeredCount: number;
    })
  | (TimedProjection & {
      status: 'active';
      phase: 'results';
      question: GuestQuizQuestion;
      selectedChoice: QuizChoice | null;
      answeredCount: number;
      results: QuizResults;
    });

export type SubmitQuizVoteResult = {
  status: 'accepted' | 'already_voted';
  choice: QuizChoice;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChoice(value: unknown): value is QuizChoice {
  return value === 'liza' || value === 'viktor';
}

function isQuestionType(value: unknown): value is QuizQuestionType {
  return value === 'standard' || value === 'final_five';
}

function parseQuestion(value: unknown): GuestQuizQuestion {
  if (!isRecord(value)) throw new Error('Unexpected quiz question response');
  if (
    typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.text !== 'string'
    || value.text.trim().length === 0
    || !isQuestionType(value.questionType)
    || !(value.imagePath === null || typeof value.imagePath === 'string')
  ) {
    throw new Error('Unexpected quiz question response');
  }

  return {
    id: value.id,
    text: value.text,
    questionType: value.questionType,
    imagePath: value.imagePath,
  };
}

function parseCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Unexpected quiz count');
  }
  return value;
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('Unexpected quiz timestamp');
  }
  return value;
}

function parseOptionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseTimestamp(value);
}

function parseResults(value: unknown): QuizResults {
  if (!isRecord(value)) throw new Error('Unexpected quiz results');
  return {
    liza: parseCount(value.liza),
    viktor: parseCount(value.viktor),
    total: parseCount(value.total),
  };
}

function parseHistory(value: unknown): QuizHistoryEntry[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('Unexpected quiz history');
  return value.map((entry) => {
    if (!isRecord(entry)
      || typeof entry.roundId !== 'string'
      || typeof entry.questionId !== 'string'
      || typeof entry.questionText !== 'string'
      || !isQuestionType(entry.questionType)
    ) {
      throw new Error('Unexpected quiz history');
    }
    const selectedChoice = entry.selectedChoice == null ? null : entry.selectedChoice;
    if (selectedChoice !== null && !isChoice(selectedChoice)) {
      throw new Error('Unexpected quiz history');
    }
    return {
      roundId: entry.roundId,
      questionId: entry.questionId,
      questionText: entry.questionText,
      questionType: entry.questionType,
      closedAt: parseTimestamp(entry.closedAt),
      answeredCount: parseCount(entry.answeredCount),
      results: parseResults(entry.results),
      selectedChoice,
    };
  });
}

function parseTimedProjection(data: Record<string, unknown>): TimedProjection {
  const timed: TimedProjection = {};
  if (typeof data.roundId === 'string') timed.roundId = data.roundId;
  const phaseStartedAt = parseOptionalTimestamp(data.phaseStartedAt);
  const phaseEndsAt = parseOptionalTimestamp(data.phaseEndsAt);
  const history = parseHistory(data.history);
  if (phaseStartedAt !== undefined) timed.phaseStartedAt = phaseStartedAt;
  if (phaseEndsAt !== undefined) timed.phaseEndsAt = phaseEndsAt;
  if (history !== undefined) timed.history = history;
  return timed;
}

function throwRpcError(error: Exclude<QuizRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Quiz request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function getGuestQuizState(
  client: QuizRpcClient,
  eventSlug: string,
  deviceKey: string,
): Promise<GuestQuizState> {
  const { data, error } = await client.rpc('get_quiz_state', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Unexpected quiz-state response');
  }

  if (data.status === 'not_found') return { status: 'not_found' };
  if (data.status === 'not_registered') return { status: 'not_registered' };
  if (data.status === 'idle') {
    const history = parseHistory(data.history);
    return history === undefined ? { status: 'idle' } : { status: 'idle', history };
  }
  if (data.status !== 'active') throw new Error('Unexpected quiz-state response');

  if (data.phase !== 'voting' && data.phase !== 'results') {
    throw new Error('Unexpected quiz phase');
  }

  const selectedChoice = data.selectedChoice === null || data.selectedChoice === undefined
    ? null
    : data.selectedChoice;
  if (selectedChoice !== null && !isChoice(selectedChoice)) {
    throw new Error('Unexpected selected quiz choice');
  }

  const base = {
    ...parseTimedProjection(data),
    status: 'active' as const,
    question: parseQuestion(data.question),
    selectedChoice,
    answeredCount: parseCount(data.answeredCount),
  };

  if (data.phase === 'voting') {
    return { ...base, phase: 'voting' };
  }

  return {
    ...base,
    phase: 'results',
    results: parseResults(data.results),
  };
}

export async function submitGuestQuizVote(
  client: QuizRpcClient,
  eventSlug: string,
  deviceKey: string,
  questionId: string,
  choice: QuizChoice,
): Promise<SubmitQuizVoteResult> {
  const { data, error } = await client.rpc('submit_quiz_vote', {
    p_event_slug: eventSlug,
    p_device_key: deviceKey,
    p_question_id: questionId,
    p_choice: choice,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || (data.status !== 'accepted' && data.status !== 'already_voted')
    || !isChoice(data.choice)
  ) {
    throw new Error('Unexpected quiz-vote response');
  }

  return {
    status: data.status,
    choice: data.choice,
  };
}
