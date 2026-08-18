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

type AdminQuizBase = {
  status: 'ok';
  currentQuestionId: string | null;
  answeredCount: number;
  questions: AdminQuizQuestion[];
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
  phase: 'voting';
};

export type RevealQuizResultsResult = {
  status: 'revealed';
  questionId: string;
  results: QuizResults;
};

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
  if (
    !isRecord(data)
    || (data.status !== 'seeded' && data.status !== 'existing')
  ) {
    throw new Error('Unexpected quiz-seed response');
  }
  return {
    status: data.status,
    insertedCount: parseCount(data.insertedCount),
  };
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
    phase: 'voting',
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
  if (
    !isRecord(data)
    || data.status !== 'revealed'
    || typeof data.questionId !== 'string'
  ) {
    throw new Error('Unexpected quiz-reveal response');
  }
  return {
    status: 'revealed',
    questionId: data.questionId,
    results: parseResults(data.results),
  };
}
