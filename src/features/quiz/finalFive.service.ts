export type FinalFiveRole = 'liza' | 'viktor';
export type FinalFiveChoice = 'liza' | 'viktor';

export type FinalFiveRpcError = Error | { message?: string; code?: string } | null;
export type FinalFiveRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: FinalFiveRpcError }>;
};

export type FinalFiveRoleState =
  | { status: 'invalid_access' | 'not_found' }
  | { status: 'idle'; role: FinalFiveRole }
  | {
      status: 'active';
      role: FinalFiveRole;
      phase: 'voting' | 'results';
      question: { id: string; text: string };
      selectedChoice: FinalFiveChoice | null;
    };

export type SubmitFinalFiveAnswerResult = {
  status: 'accepted';
  questionId: string;
  role: FinalFiveRole;
  choice: FinalFiveChoice;
};

export type SeedFinalFiveResult = { status: 'ready'; questionCount: number };
export type IssuedFinalFiveRoleAccess = { status: 'issued'; role: FinalFiveRole; token: string };

export type OwnerFinalFiveStatus =
  | { status: 'not_ready' }
  | {
      status: 'ok';
      current: boolean;
      phase: 'idle' | 'voting' | 'results';
      answeredCount: number;
      lizaAnswered: boolean;
      viktorAnswered: boolean;
      revealed: boolean;
    };

export type RevealFinalFiveResult = { status: 'revealed'; questionId: string };

export type RevealedFinalFive =
  | { status: 'hidden' | 'not_found' }
  | {
      status: 'revealed';
      question: { id: string; text: string };
      results: { liza: number; viktor: number; total: number };
      lizaAnswer: FinalFiveChoice;
      viktorAnswer: FinalFiveChoice;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(): never {
  throw new Error('Unexpected final-five response');
}

function throwRpcError(error: Exclude<FinalFiveRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Final-five request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function isRole(value: unknown): value is FinalFiveRole {
  return value === 'liza' || value === 'viktor';
}

function isChoice(value: unknown): value is FinalFiveChoice {
  return value === 'liza' || value === 'viktor';
}

function parseQuestion(value: unknown): { id: string; text: string } {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.text !== 'string' || !value.text) fail();
  return { id: value.id, text: value.text };
}

function parseCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail();
  return value;
}

export async function getFinalFiveRoleState(
  client: FinalFiveRpcClient,
  eventSlug: string,
  role: FinalFiveRole,
  token: string,
): Promise<FinalFiveRoleState> {
  const { data, error } = await client.rpc('get_final_five_role_state', {
    p_event_slug: eventSlug,
    p_role: role,
    p_token: token,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  if (data.status === 'invalid_access' || data.status === 'not_found') return { status: data.status };
  if (data.status === 'idle' && isRole(data.role)) return { status: 'idle', role: data.role };
  if (
    data.status === 'active'
    && isRole(data.role)
    && (data.phase === 'voting' || data.phase === 'results')
    && (data.selectedChoice === null || isChoice(data.selectedChoice))
  ) {
    return {
      status: 'active',
      role: data.role,
      phase: data.phase,
      question: parseQuestion(data.question),
      selectedChoice: data.selectedChoice,
    };
  }
  return fail();
}

export async function submitFinalFiveAnswer(
  client: FinalFiveRpcClient,
  eventSlug: string,
  role: FinalFiveRole,
  token: string,
  questionId: string,
  choice: FinalFiveChoice,
): Promise<SubmitFinalFiveAnswerResult> {
  const { data, error } = await client.rpc('submit_final_five_answer', {
    p_event_slug: eventSlug,
    p_role: role,
    p_token: token,
    p_question_id: questionId,
    p_choice: choice,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'accepted'
    || typeof data.questionId !== 'string'
    || !isRole(data.role)
    || !isChoice(data.choice)
  ) return fail();
  return { status: 'accepted', questionId: data.questionId, role: data.role, choice: data.choice };
}

export async function seedFinalFiveQuestions(
  client: FinalFiveRpcClient,
  eventId: string,
): Promise<SeedFinalFiveResult> {
  const { data, error } = await client.rpc('owner_seed_final_five_questions', { p_event_id: eventId });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'ready') return fail();
  const questionCount = parseCount(data.questionCount);
  if (questionCount !== 5) return fail();
  return { status: 'ready', questionCount };
}

export async function issueFinalFiveRoleAccess(
  client: FinalFiveRpcClient,
  eventId: string,
  role: FinalFiveRole,
): Promise<IssuedFinalFiveRoleAccess> {
  const { data, error } = await client.rpc('owner_issue_final_five_role_access', {
    p_event_id: eventId,
    p_role: role,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'issued' || !isRole(data.role) || typeof data.token !== 'string' || !data.token) return fail();
  return { status: 'issued', role: data.role, token: data.token };
}

export async function getOwnerFinalFiveStatus(
  client: FinalFiveRpcClient,
  eventId: string,
  questionId: string,
): Promise<OwnerFinalFiveStatus> {
  const { data, error } = await client.rpc('owner_get_final_five_status', {
    p_event_id: eventId,
    p_question_id: questionId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  if (data.status === 'not_ready') return { status: 'not_ready' };
  if (
    data.status === 'ok'
    && typeof data.current === 'boolean'
    && (data.phase === 'idle' || data.phase === 'voting' || data.phase === 'results')
    && typeof data.lizaAnswered === 'boolean'
    && typeof data.viktorAnswered === 'boolean'
    && typeof data.revealed === 'boolean'
  ) {
    return {
      status: 'ok',
      current: data.current,
      phase: data.phase,
      answeredCount: parseCount(data.answeredCount),
      lizaAnswered: data.lizaAnswered,
      viktorAnswered: data.viktorAnswered,
      revealed: data.revealed,
    };
  }
  return fail();
}

export async function revealFinalFive(
  client: FinalFiveRpcClient,
  eventId: string,
  questionId: string,
): Promise<RevealFinalFiveResult> {
  const { data, error } = await client.rpc('owner_reveal_final_five', {
    p_event_id: eventId,
    p_question_id: questionId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data) || data.status !== 'revealed' || typeof data.questionId !== 'string' || !data.questionId) return fail();
  return { status: 'revealed', questionId: data.questionId };
}

export async function getRevealedFinalFive(
  client: FinalFiveRpcClient,
  eventSlug: string,
): Promise<RevealedFinalFive> {
  const { data, error } = await client.rpc('get_revealed_final_five', { p_event_slug: eventSlug });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  if (data.status === 'hidden' || data.status === 'not_found') return { status: data.status };
  if (data.status !== 'revealed' || !isChoice(data.lizaAnswer) || !isChoice(data.viktorAnswer) || !isRecord(data.results)) return fail();

  const results = {
    liza: parseCount(data.results.liza),
    viktor: parseCount(data.results.viktor),
    total: parseCount(data.results.total),
  };
  if (results.liza + results.viktor !== results.total) return fail();

  return {
    status: 'revealed',
    question: parseQuestion(data.question),
    results,
    lizaAnswer: data.lizaAnswer,
    viktorAnswer: data.viktorAnswer,
  };
}
