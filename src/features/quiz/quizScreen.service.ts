import type { QuizQuestionType, QuizResults } from './quiz.service';

export type QuizScreenRpcError = Error | { message?: string; code?: string } | null;

export type QuizScreenRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: QuizScreenRpcError }>;
};

export type QuizScreenQuestion = {
  id: string;
  text: string;
  questionType: QuizQuestionType;
  imagePath: string | null;
};

type QuizScreenTiming = {
  roundId?: string;
  phaseStartedAt?: string | null;
  phaseEndsAt?: string | null;
};

export type QuizScreenState =
  | { status: 'idle' }
  | { status: 'not_found' }
  | (QuizScreenTiming & {
      status: 'active';
      phase: 'voting';
      question: QuizScreenQuestion;
      answeredCount: number;
    })
  | (QuizScreenTiming & {
      status: 'active';
      phase: 'results';
      question: QuizScreenQuestion;
      answeredCount: number;
      results: QuizResults;
    });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function throwRpcError(error: Exclude<QuizScreenRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Projector quiz request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function fail(): never {
  throw new Error('Unexpected projector quiz-state response');
}

function parseCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail();
  return value;
}

function parseOptionalTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail();
  return value;
}

function parseQuestion(value: unknown): QuizScreenQuestion {
  if (!isRecord(value)) fail();
  if (
    typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.text !== 'string'
    || value.text.trim().length === 0
    || (value.questionType !== 'standard' && value.questionType !== 'final_five')
    || !(value.imagePath === null || typeof value.imagePath === 'string')
  ) {
    fail();
  }

  return {
    id: value.id,
    text: value.text,
    questionType: value.questionType,
    imagePath: value.imagePath,
  };
}

function parseResults(value: unknown): QuizResults {
  if (!isRecord(value)) fail();
  const liza = parseCount(value.liza);
  const viktor = parseCount(value.viktor);
  const total = parseCount(value.total);
  if (liza + viktor !== total) fail();
  return { liza, viktor, total };
}

function parseTiming(data: Record<string, unknown>): QuizScreenTiming {
  return {
    roundId: typeof data.roundId === 'string' ? data.roundId : undefined,
    phaseStartedAt: parseOptionalTimestamp(data.phaseStartedAt),
    phaseEndsAt: parseOptionalTimestamp(data.phaseEndsAt),
  };
}

function parseState(data: unknown): QuizScreenState {
  if (!isRecord(data)) fail();
  if (data.status === 'idle') return { status: 'idle' };
  if (data.status === 'not_found') return { status: 'not_found' };
  if (data.status !== 'active') fail();

  const question = parseQuestion(data.question);
  const answeredCount = parseCount(data.answeredCount);
  const timing = parseTiming(data);

  if (data.phase === 'voting') {
    if ('results' in data) fail();
    return {
      ...timing,
      status: 'active',
      phase: 'voting',
      question,
      answeredCount,
    };
  }

  if (data.phase === 'results') {
    return {
      ...timing,
      status: 'active',
      phase: 'results',
      question,
      answeredCount,
      results: parseResults(data.results),
    };
  }

  return fail();
}

export async function getQuizScreenState(
  client: QuizScreenRpcClient,
  eventSlug: string,
): Promise<QuizScreenState> {
  const { data, error } = await client.rpc('get_quiz_screen_state', {
    p_event_slug: eventSlug,
  });
  if (error) throwRpcError(error);
  return parseState(data);
}
