import type { QuizQuestionType, QuizResults } from './quiz.service';

export type AdminQuizRpcError = Error | { message?: string; code?: string } | null;

export type AdminQuizRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: AdminQuizRpcError }>;
};

export type AdminQuizQuestion = {
  id: string;
  text: string;
  questionType: QuizQuestionType;
  sortOrder: number;
  enabled: boolean;
  imagePath: string | null;
};

export type AdminQuizHistoryEntry = {
  roundId: string;
  questionId: string;
  questionText: string;
  questionType: QuizQuestionType;
  closedAt: string;
  answeredCount: number;
  results: QuizResults;
};

type AdminQuizBase = {
  status: 'ok';
  currentQuestionId: string | null;
  answeredCount: number;
  questions: AdminQuizQuestion[];
  history?: AdminQuizHistoryEntry[];
  roundId?: string | null;
  phaseStartedAt?: string | null;
  phaseEndsAt?: string | null;
  presentOnMainScreen?: boolean;
};

export type AdminQuizControl =
  | (AdminQuizBase & { phase: 'idle' })
  | (AdminQuizBase & { phase: 'voting' })
  | (AdminQuizBase & { phase: 'results'; results: QuizResults });

export type SeedQuizQuestionsResult = {
  status: 'seeded' | 'existing';
  insertedCount: number;
};

export type ActivateQuizQuestionResult = {
  status: 'active';
  questionId: string;
  roundId?: string;
  phase: 'voting';
  phaseStartedAt?: string | null;
  phaseEndsAt?: string | null;
};

export type RevealQuizResultsResult = {
  status: 'revealed';
  questionId: string;
  roundId?: string;
  phase?: 'results';
  phaseStartedAt?: string | null;
  phaseEndsAt?: string | null;
  results: QuizResults;
};

export type CloseQuizRoundResult = {
  status: 'closed';
  roundId: string | null;
  questionId: string | null;
};

export type ReturnQuizMainResult = { status: 'main_screen' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Unexpected quiz count');
  }
  return value;
}

function parseQuestionType(value: unknown): QuizQuestionType {
  if (value !== 'standard' && value !== 'final_five') {
    throw new Error('Unexpected quiz question type');
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

function parseQuestion(value: unknown): AdminQuizQuestion {
  if (!isRecord(value)) throw new Error('Unexpected owner quiz question');
  if (
    typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.text !== 'string'
    || value.text.trim().length === 0
    || typeof value.sortOrder !== 'number'
    || !Number.isFinite(value.sortOrder)
    || typeof value.enabled !== 'boolean'
    || !(value.imagePath === null || typeof value.imagePath === 'string')
  ) {
    throw new Error('Unexpected owner quiz question');
  }

  return {
    id: value.id,
    text: value.text,
    questionType: parseQuestionType(value.questionType),
    sortOrder: value.sortOrder,
    enabled: value.enabled,
    imagePath: value.imagePath,
  };
}

function parseHistory(value: unknown): AdminQuizHistoryEntry[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('Unexpected owner quiz history');
  return value.map((entry) => {
    if (!isRecord(entry)
      || typeof entry.roundId !== 'string'
      || typeof entry.questionId !== 'string'
      || typeof entry.questionText !== 'string'
    ) {
      throw new Error('Unexpected owner quiz history');
    }
    return {
      roundId: entry.roundId,
      questionId: entry.questionId,
      questionText: entry.questionText,
      questionType: parseQuestionType(entry.questionType),
      closedAt: parseTimestamp(entry.closedAt),
      answeredCount: parseCount(entry.answeredCount),
      results: parseResults(entry.results),
    };
  });
}

function throwRpcError(error: Exclude<AdminQuizRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Owner quiz request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function getOwnerQuizControl(
  client: AdminQuizRpcClient,
  eventId: string,
): Promise<AdminQuizControl> {
  const { data, error } = await client.rpc('owner_get_quiz_control', {
    p_event_id: eventId,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'ok'
    || !Array.isArray(data.questions)
    || (data.phase !== 'idle' && data.phase !== 'voting' && data.phase !== 'results')
    || !(data.currentQuestionId === null || typeof data.currentQuestionId === 'string')
  ) {
    throw new Error('Unexpected owner quiz-control response');
  }

  const base: AdminQuizBase = {
    status: 'ok',
    currentQuestionId: data.currentQuestionId,
    answeredCount: parseCount(data.answeredCount),
    questions: data.questions.map(parseQuestion),
    history: parseHistory(data.history),
    roundId: data.roundId === null || data.roundId === undefined
      ? data.roundId as null | undefined
      : typeof data.roundId === 'string' ? data.roundId : undefined,
    phaseStartedAt: parseOptionalTimestamp(data.phaseStartedAt),
    phaseEndsAt: parseOptionalTimestamp(data.phaseEndsAt),
    presentOnMainScreen: typeof data.presentOnMainScreen === 'boolean'
      ? data.presentOnMainScreen
      : undefined,
  };

  if (data.phase === 'results') {
    return {
      ...base,
      phase: 'results',
      results: parseResults(data.results),
    };
  }

  return { ...base, phase: data.phase };
}

export async function seedDefaultQuizQuestions(
  client: AdminQuizRpcClient,
  eventId: string,
): Promise<SeedQuizQuestionsResult> {
  const { data, error } = await client.rpc('owner_seed_default_quiz_questions', {
    p_event_id: eventId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || (data.status !== 'seeded' && data.status !== 'existing')) {
    throw new Error('Unexpected quiz-seed response');
  }
  return { status: data.status, insertedCount: parseCount(data.insertedCount) };
}

export async function activateOwnerQuizQuestion(
  client: AdminQuizRpcClient,
  eventId: string,
  questionId: string,
): Promise<ActivateQuizQuestionResult> {
  const { data, error } = await client.rpc('owner_activate_quiz_question', {
    p_event_id: eventId,
    p_question_id: questionId,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'active'
    || data.phase !== 'voting'
    || typeof data.questionId !== 'string'
  ) {
    throw new Error('Unexpected quiz-activation response');
  }
  return {
    status: 'active',
    questionId: data.questionId,
    roundId: typeof data.roundId === 'string' ? data.roundId : undefined,
    phase: 'voting',
    phaseStartedAt: parseOptionalTimestamp(data.phaseStartedAt),
    phaseEndsAt: parseOptionalTimestamp(data.phaseEndsAt),
  };
}

export async function revealOwnerQuizResults(
  client: AdminQuizRpcClient,
  eventId: string,
  questionId: string,
): Promise<RevealQuizResultsResult> {
  const { data, error } = await client.rpc('owner_reveal_quiz_results', {
    p_event_id: eventId,
    p_question_id: questionId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'revealed' || typeof data.questionId !== 'string') {
    throw new Error('Unexpected quiz-reveal response');
  }
  return {
    status: 'revealed',
    questionId: data.questionId,
    roundId: typeof data.roundId === 'string' ? data.roundId : undefined,
    phase: data.phase === 'results' ? 'results' : undefined,
    phaseStartedAt: parseOptionalTimestamp(data.phaseStartedAt),
    phaseEndsAt: parseOptionalTimestamp(data.phaseEndsAt),
    results: parseResults(data.results),
  };
}

export async function closeOwnerQuizRound(
  client: AdminQuizRpcClient,
  eventId: string,
): Promise<CloseQuizRoundResult> {
  const { data, error } = await client.rpc('owner_close_quiz_round', { p_event_id: eventId });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'closed') throw new Error('Unexpected quiz-close response');
  if (!(data.roundId === null || typeof data.roundId === 'string')
    || !(data.questionId === null || typeof data.questionId === 'string')) {
    throw new Error('Unexpected quiz-close response');
  }
  return { status: 'closed', roundId: data.roundId, questionId: data.questionId };
}

export async function returnOwnerQuizToMainScreen(
  client: AdminQuizRpcClient,
  eventId: string,
): Promise<ReturnQuizMainResult> {
  const { data, error } = await client.rpc('owner_return_quiz_to_main_screen', { p_event_id: eventId });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'main_screen') {
    throw new Error('Unexpected quiz-main-screen response');
  }
  return { status: 'main_screen' };
}
