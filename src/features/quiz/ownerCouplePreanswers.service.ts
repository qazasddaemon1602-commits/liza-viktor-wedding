export type OwnerCouplePreanswerRpcError = Error | { message?: string; code?: string } | null;

export type OwnerCouplePreanswerRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: OwnerCouplePreanswerRpcError }>;
};

export type OwnerCouplePreanswerStatus = {
  status: 'not_issued' | 'active' | 'finalized';
  answeredCount: number;
  totalCount: number;
  issuedAt: string | null;
  finalizedAt: string | null;
};

export type IssuedCouplePreanswerAccess = {
  status: 'issued';
  token: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(): never {
  throw new Error('Unexpected owner couple preanswer response');
}

function throwRpcError(error: Exclude<OwnerCouplePreanswerRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Owner couple preanswer request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function parseCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) fail();
  return value;
}

function parseNullableDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail();
  return value;
}

export async function getOwnerCouplePreanswerStatus(
  client: OwnerCouplePreanswerRpcClient,
  eventId: string,
): Promise<OwnerCouplePreanswerStatus> {
  const { data, error } = await client.rpc('owner_get_couple_preanswer_status', {
    p_event_id: eventId,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  if (data.status !== 'not_issued' && data.status !== 'active' && data.status !== 'finalized') fail();

  const answeredCount = parseCount(data.answeredCount);
  const totalCount = parseCount(data.totalCount);
  if (answeredCount > totalCount) fail();

  const issuedAt = parseNullableDate(data.issuedAt);
  const finalizedAt = parseNullableDate(data.finalizedAt);

  if (data.status === 'not_issued' && (issuedAt !== null || finalizedAt !== null)) fail();
  if (data.status === 'active' && issuedAt === null) fail();
  if (data.status === 'finalized' && (issuedAt === null || finalizedAt === null)) fail();

  return {
    status: data.status,
    answeredCount,
    totalCount,
    issuedAt,
    finalizedAt,
  };
}

export async function issueOwnerCouplePreanswerAccess(
  client: OwnerCouplePreanswerRpcClient,
  eventId: string,
): Promise<IssuedCouplePreanswerAccess> {
  const { data, error } = await client.rpc('owner_issue_couple_preanswer_access', {
    p_event_id: eventId,
  });
  if (error) throwRpcError(error);
  if (
    !isRecord(data)
    || data.status !== 'issued'
    || typeof data.token !== 'string'
    || data.token.length < 16
  ) {
    fail();
  }
  return { status: 'issued', token: data.token };
}
