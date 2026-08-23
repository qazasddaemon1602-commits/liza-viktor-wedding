import {
  BUNKER_OPERATOR_PHRASES,
  getDeterministicFallback,
  type BunkerOperatorPhrase,
  type BunkerOperatorStage,
} from './bunkerOperator.contract';

export type BunkerOperatorRpcError = Error | { message?: string; code?: string } | null;
export type BunkerOperatorRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: BunkerOperatorRpcError }>;
};

export type BunkerOperatorMessage = {
  id: string;
  stage: BunkerOperatorStage;
  optionKey: string;
  body: string;
  source: 'selected' | 'fallback';
  publishedAt: string;
};

export type LizaBunkerOperatorState =
  | { status: 'invalid_access' }
  | {
      status: 'idle';
      bunkerActive: boolean;
      globalGameState: string | null;
      serverNow: string;
    }
  | {
      status: 'active';
      bunkerActive: true;
      globalGameState: BunkerOperatorStage;
      stage: BunkerOperatorStage;
      enteredAt: string;
      sendUntil: string;
      serverNow: string;
      windowOpen: boolean;
      options: readonly [BunkerOperatorPhrase, BunkerOperatorPhrase];
      selectedMessage: BunkerOperatorMessage | null;
    }
  | {
      status: 'revealed';
      bunkerActive: true;
      globalGameState: 'BUNKER_OPEN';
      serverNow: string;
    }
  | {
      status: 'finished';
      bunkerActive: true;
      globalGameState: 'FINISHED';
      serverNow: string;
    };

export type SubmitLizaBunkerOperatorResult = {
  status: 'accepted' | 'locked';
  serverNow: string;
  message: BunkerOperatorMessage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(): never {
  throw new Error('Unexpected Liza operator response');
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail();
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isStage(value: unknown): value is BunkerOperatorStage {
  return value === 'MISSION_02' || value === 'MISSION_04' || value === 'MISSION_06' || value === 'FINAL_30';
}

function parseMessage(value: unknown, expectedStage?: BunkerOperatorStage): BunkerOperatorMessage {
  if (!isRecord(value)) fail();
  assertKeys(value, ['id', 'stage', 'optionKey', 'body', 'source', 'publishedAt']);
  if (
    typeof value.id !== 'string' || !value.id
    || !isStage(value.stage)
    || (expectedStage !== undefined && value.stage !== expectedStage)
    || typeof value.optionKey !== 'string'
    || typeof value.body !== 'string'
    || (value.source !== 'selected' && value.source !== 'fallback')
    || !isTimestamp(value.publishedAt)
  ) fail();
  const approved = BUNKER_OPERATOR_PHRASES[value.stage].find(
    (option) => option.key === value.optionKey && option.body === value.body,
  );
  if (!approved) fail();
  return {
    id: value.id,
    stage: value.stage,
    optionKey: value.optionKey,
    body: value.body,
    source: value.source,
    publishedAt: value.publishedAt,
  };
}

export function parseLizaBunkerOperatorState(value: unknown): LizaBunkerOperatorState {
  if (!isRecord(value) || typeof value.status !== 'string') fail();

  if (value.status === 'invalid_access') {
    assertKeys(value, ['status']);
    return { status: 'invalid_access' };
  }

  if (value.status === 'idle') {
    assertKeys(value, ['status', 'bunkerActive', 'globalGameState', 'serverNow']);
    if (typeof value.bunkerActive !== 'boolean' || !isTimestamp(value.serverNow)) fail();
    if (value.globalGameState !== undefined && typeof value.globalGameState !== 'string') fail();
    return {
      status: 'idle',
      bunkerActive: value.bunkerActive,
      globalGameState: typeof value.globalGameState === 'string' ? value.globalGameState : null,
      serverNow: value.serverNow,
    };
  }

  if (value.status === 'revealed' || value.status === 'finished') {
    assertKeys(value, ['status', 'bunkerActive', 'globalGameState', 'serverNow']);
    const expectedState = value.status === 'revealed' ? 'BUNKER_OPEN' : 'FINISHED';
    if (value.bunkerActive !== true || value.globalGameState !== expectedState || !isTimestamp(value.serverNow)) fail();
    return {
      status: value.status,
      bunkerActive: true,
      globalGameState: expectedState,
      serverNow: value.serverNow,
    } as LizaBunkerOperatorState;
  }

  if (value.status !== 'active') fail();
  assertKeys(value, [
    'status', 'bunkerActive', 'globalGameState', 'stage', 'enteredAt', 'sendUntil',
    'serverNow', 'windowOpen', 'options', 'selectedMessage',
  ]);
  if (
    value.bunkerActive !== true
    || !isStage(value.stage)
    || value.globalGameState !== value.stage
    || !isTimestamp(value.enteredAt)
    || !isTimestamp(value.sendUntil)
    || !isTimestamp(value.serverNow)
    || typeof value.windowOpen !== 'boolean'
    || !Array.isArray(value.options)
    || value.options.length !== 2
  ) fail();

  const approved = BUNKER_OPERATOR_PHRASES[value.stage];
  const options = value.options.map((option, index) => {
    if (!isRecord(option)) fail();
    assertKeys(option, ['key', 'body']);
    if (option.key !== approved[index].key || option.body !== approved[index].body) fail();
    return approved[index];
  }) as unknown as readonly [BunkerOperatorPhrase, BunkerOperatorPhrase];
  const selectedMessage = value.selectedMessage === null
    ? null
    : parseMessage(value.selectedMessage, value.stage);
  const enteredAtMilliseconds = Date.parse(value.enteredAt);
  const sendUntilMilliseconds = Date.parse(value.sendUntil);
  const serverNowMilliseconds = Date.parse(value.serverNow);
  if (
    sendUntilMilliseconds - enteredAtMilliseconds !== 45_000
    || serverNowMilliseconds < enteredAtMilliseconds
  ) fail();
  const beforeDeadline = serverNowMilliseconds < sendUntilMilliseconds;
  if (selectedMessage === null) {
    if (!beforeDeadline || value.windowOpen !== true) fail();
  } else {
    if (value.windowOpen) fail();
    if (selectedMessage.source === 'fallback') {
      const fallback = getDeterministicFallback(value.stage);
      if (
        beforeDeadline
        || selectedMessage.optionKey !== fallback.key
        || selectedMessage.body !== fallback.body
        || Date.parse(selectedMessage.publishedAt) !== sendUntilMilliseconds
      ) fail();
    }
  }

  return {
    status: 'active',
    bunkerActive: true,
    globalGameState: value.stage,
    stage: value.stage,
    enteredAt: value.enteredAt,
    sendUntil: value.sendUntil,
    serverNow: value.serverNow,
    windowOpen: value.windowOpen,
    options,
    selectedMessage,
  };
}

function throwRpcError(error: Exclude<BunkerOperatorRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Liza operator request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function getLizaBunkerOperatorState(
  client: BunkerOperatorRpcClient,
  eventSlug: string,
  token: string,
): Promise<LizaBunkerOperatorState> {
  const { data, error } = await client.rpc('get_liza_bunker_operator_state', {
    p_event_slug: eventSlug,
    p_token: token,
  });
  if (error) throwRpcError(error);
  return parseLizaBunkerOperatorState(data);
}

export async function submitLizaBunkerOperatorPhrase(
  client: BunkerOperatorRpcClient,
  eventSlug: string,
  token: string,
  stage: BunkerOperatorStage,
  optionKey: string,
): Promise<SubmitLizaBunkerOperatorResult> {
  const { data, error } = await client.rpc('submit_liza_bunker_operator_phrase', {
    p_event_slug: eventSlug,
    p_token: token,
    p_stage: stage,
    p_option_key: optionKey,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) fail();
  assertKeys(data, ['status', 'serverNow', 'message']);
  if ((data.status !== 'accepted' && data.status !== 'locked') || !isTimestamp(data.serverNow)) fail();
  return { status: data.status, serverNow: data.serverNow, message: parseMessage(data.message, stage) };
}
