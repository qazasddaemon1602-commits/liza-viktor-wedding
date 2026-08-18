import type { QuizChoice } from './quiz.service';

export type CouplePreanswerRpcError = Error | { message?: string; code?: string } | null;

export type CouplePreanswerRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: CouplePreanswerRpcError }>;
};

export type CouplePreanswerQuestion = {
  id: string;
  text: string;
  sortOrder: number;
  imagePath: string | null;
  choice: QuizChoice | null;
};

export type CouplePreanswerForm =
  | { status: 'not_found' }
  | { status: 'finished' }
  | {
      status: 'active';
      eventId: string;
      answeredCount: number;
      totalCount: number;
      questions: CouplePreanswerQuestion[];
    };

export type SavedCouplePreanswer = {
  status: 'saved';
  questionId: string;
  choice: QuizChoice;
};

export type FinalizedCouplePreanswers =
  | { status: 'finished' }
  | { status: 'finalized'; answerCount: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(): never {
  throw new Error('Unexpected couple preanswer response');
}

function throwRpcError(error: Exclude<CouplePreanswerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Couple preanswer request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function parseChoice(value: unknown, allowNull = false): QuizChoice | null {
  if (allowNull && value === null) return null;
  if (value === 'liza' || value === 'viktor') return value;
  return fail();
}

function parseCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail();
  return value;
}

function parseQuestion(value: unknown): CouplePreanswerQuestion {
  if (!isRecord(value)) fail();
  if (
    typeof value.id !== 'string'
    || value.id.length === 0
    || typeof value.text !== 'string'
    || value.text.trim().length === 0
    || typeof value.sortOrder !== 'number'
    || !Number.isInteger(value.sortOrder)
    || !(value.imagePath === null || typeof value.imagePath === 'string')
  ) {
    fail();
  }
  return {
    id: value.id,
    text: value.text,
    sortOrder: value.sortOrder,
    imagePath: value.imagePath,
    choice: parseChoice(value.choice, true),
  };
}

export async function getCouplePreanswerForm(
  client: CouplePreanswerRpcClient,
  eventSlug: string,
  token: string,
): Promise<CouplePreanswerForm> {
  const { data, error } = await client.rpc('get_couple_preanswer_form', {
    p_event_slug: eventSlug,
    p_token: token,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  if (data.status === 'not_found') return { status: 'not_found' };
  if (data.status === 'finished') return { status: 'finished' };
  if (
    data.status !== 'active'
    || typeof data.eventId !== 'string'
    || !Array.isArray(data.questions)
  ) {
    fail();
  }

  const answeredCount = parseCount(data.answeredCount);
  const totalCount = parseCount(data.totalCount);
  const questions = data.questions.map(parseQuestion);
  if (answeredCount > totalCount || totalCount !== questions.length) fail();
  const actualAnswered = questions.filter((question) => question.choice !== null).length;
  if (answeredCount !== actualAnswered) fail();

  return {
    status: 'active',
    eventId: data.eventId,
    answeredCount,
    totalCount,
    questions,
  };
}

export async function saveCouplePreanswer(
  client: CouplePreanswerRpcClient,
  eventSlug: string,
  token: string,
  questionId: string,
  choice: QuizChoice,
): Promise<SavedCouplePreanswer> {
  const { data, error } = await client.rpc('save_couple_preanswer', {
    p_event_slug: eventSlug,
    p_token: token,
    p_question_id: questionId,
    p_choice: choice,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'saved'
    || typeof data.questionId !== 'string'
  ) {
    fail();
  }
  return {
    status: 'saved',
    questionId: data.questionId,
    choice: parseChoice(data.choice) as QuizChoice,
  };
}

export async function finalizeCouplePreanswers(
  client: CouplePreanswerRpcClient,
  eventSlug: string,
  token: string,
): Promise<FinalizedCouplePreanswers> {
  const { data, error } = await client.rpc('finalize_couple_preanswers', {
    p_event_slug: eventSlug,
    p_token: token,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  if (data.status === 'finished') return { status: 'finished' };
  if (data.status !== 'finalized') fail();
  return {
    status: 'finalized',
    answerCount: parseCount(data.answerCount),
  };
}
