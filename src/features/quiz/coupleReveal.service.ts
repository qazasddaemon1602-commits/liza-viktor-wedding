export type CoupleRevealRpcError = Error | { message?: string; code?: string } | null;

export type CoupleRevealRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: CoupleRevealRpcError }>;
};

export type OwnerCoupleRevealStatus =
  | { status: 'not_ready'; revealed: false }
  | { status: 'ready'; revealed: false }
  | { status: 'revealed'; revealed: true };

export type RevealOwnerCoupleAnswerResult = {
  status: 'revealed';
  questionId: string;
};

export type RevealedCoupleAnswer =
  | { status: 'hidden' }
  | { status: 'not_found' }
  | { status: 'revealed'; questionId: string; choice: 'liza' | 'viktor' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(): never {
  throw new Error('Unexpected couple reveal response');
}

function throwRpcError(error: Exclude<CoupleRevealRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Couple reveal request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function getOwnerCoupleRevealStatus(
  client: CoupleRevealRpcClient,
  eventId: string,
  questionId: string,
): Promise<OwnerCoupleRevealStatus> {
  const { data, error } = await client.rpc('owner_get_couple_reveal_status', {
    p_event_id: eventId,
    p_question_id: questionId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();

  if (data.status === 'not_ready' && data.revealed === false) {
    return { status: 'not_ready', revealed: false };
  }
  if (data.status === 'ready' && data.revealed === false) {
    return { status: 'ready', revealed: false };
  }
  if (data.status === 'revealed' && data.revealed === true) {
    return { status: 'revealed', revealed: true };
  }
  return fail();
}

export async function revealOwnerCoupleAnswer(
  client: CoupleRevealRpcClient,
  eventId: string,
  questionId: string,
): Promise<RevealOwnerCoupleAnswerResult> {
  const { data, error } = await client.rpc('owner_reveal_couple_preanswer', {
    p_event_id: eventId,
    p_question_id: questionId,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'revealed'
    || typeof data.questionId !== 'string'
    || data.questionId.length === 0
  ) {
    return fail();
  }
  return { status: 'revealed', questionId: data.questionId };
}

export async function getRevealedCoupleAnswer(
  client: CoupleRevealRpcClient,
  eventSlug: string,
): Promise<RevealedCoupleAnswer> {
  const { data, error } = await client.rpc('get_revealed_couple_answer', {
    p_event_slug: eventSlug,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();

  if (data.status === 'hidden') return { status: 'hidden' };
  if (data.status === 'not_found') return { status: 'not_found' };
  if (
    data.status === 'revealed'
    && typeof data.questionId === 'string'
    && data.questionId.length > 0
    && (data.choice === 'liza' || data.choice === 'viktor')
  ) {
    return {
      status: 'revealed',
      questionId: data.questionId,
      choice: data.choice,
    };
  }
  return fail();
}
