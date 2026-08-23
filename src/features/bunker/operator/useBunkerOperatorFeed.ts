import { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import {
  subscribeToBunkerRefresh,
  type BunkerRealtimeClient,
} from '../bunker.realtime';
import {
  BUNKER_OPERATOR_PHRASES,
  type BunkerOperatorStage,
} from './bunkerOperator.contract';

export type BunkerOperatorMessage = {
  id: string;
  stage: BunkerOperatorStage;
  body: string;
  source: 'selected' | 'fallback';
  publishedAt: string;
};

export type BunkerOperatorFeed = {
  status: 'idle' | 'active';
  active: boolean;
  globalGameState: string | null;
  revealed: boolean;
  serverNow: string;
  message: BunkerOperatorMessage | null;
};

type RpcError = Error | { message?: string; code?: string } | null;
export type BunkerOperatorFeedRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError }>;
};

export type BunkerOperatorFeedDependencies = {
  load: () => Promise<BunkerOperatorFeed>;
  subscribe?: (callback: () => void) => () => void;
  pollIntervalMs?: number;
};

type UseBunkerOperatorFeedOptions = {
  eventSlug: string;
  enabled?: boolean;
  dependencies?: BunkerOperatorFeedDependencies | null;
};

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const FEED_ERROR = 'Не удалось обновить канал оператора.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(): never {
  throw new Error('Unexpected bunker operator feed response');
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail();
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isStage(value: unknown): value is BunkerOperatorStage {
  return value === 'MISSION_02'
    || value === 'MISSION_04'
    || value === 'MISSION_06'
    || value === 'FINAL_30';
}

function parseMessage(value: unknown): BunkerOperatorMessage {
  if (!isRecord(value)) fail();
  assertKeys(value, ['id', 'stage', 'body', 'source', 'publishedAt']);
  if (
    typeof value.id !== 'string'
    || !value.id
    || !isStage(value.stage)
    || typeof value.body !== 'string'
    || (value.source !== 'selected' && value.source !== 'fallback')
    || !isTimestamp(value.publishedAt)
    || !BUNKER_OPERATOR_PHRASES[value.stage].some((phrase) => phrase.body === value.body)
  ) fail();
  return {
    id: value.id,
    stage: value.stage,
    body: value.body,
    source: value.source,
    publishedAt: value.publishedAt,
  };
}

export function parseBunkerOperatorFeed(value: unknown): BunkerOperatorFeed {
  if (!isRecord(value) || (value.status !== 'idle' && value.status !== 'active')) fail();

  if (value.status === 'idle') {
    assertKeys(value, ['status', 'active', 'revealed', 'serverNow', 'message']);
    if (
      value.active !== false
      || value.revealed !== false
      || !isTimestamp(value.serverNow)
      || value.message !== null
    ) fail();
    return {
      status: 'idle',
      active: false,
      globalGameState: null,
      revealed: false,
      serverNow: value.serverNow,
      message: null,
    };
  }

  assertKeys(value, [
    'status', 'active', 'globalGameState', 'revealed', 'serverNow', 'message',
  ]);
  if (
    value.active !== true
    || typeof value.globalGameState !== 'string'
    || typeof value.revealed !== 'boolean'
    || !isTimestamp(value.serverNow)
    || value.revealed !== (value.globalGameState === 'BUNKER_OPEN' || value.globalGameState === 'FINISHED')
  ) fail();
  return {
    status: 'active',
    active: true,
    globalGameState: value.globalGameState,
    revealed: value.revealed,
    serverNow: value.serverNow,
    message: value.message === null ? null : parseMessage(value.message),
  };
}

function throwRpcError(error: Exclude<RpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Bunker operator feed request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

export async function getBunkerOperatorFeed(
  client: BunkerOperatorFeedRpcClient,
  eventSlug: string,
): Promise<BunkerOperatorFeed> {
  const { data, error } = await client.rpc('get_bunker_operator_feed', {
    p_event_slug: eventSlug,
  });
  if (error) throwRpcError(error);
  return parseBunkerOperatorFeed(data);
}

function browserDependencies(eventSlug: string): BunkerOperatorFeedDependencies | null {
  try {
    const client = getSupabaseClient();
    return {
      load: () => getBunkerOperatorFeed(client as unknown as BunkerOperatorFeedRpcClient, eventSlug),
      subscribe: (callback) => subscribeToBunkerRefresh(
        client as unknown as BunkerRealtimeClient,
        eventSlug,
        callback,
      ),
    };
  } catch {
    return null;
  }
}

export function useBunkerOperatorFeed({
  eventSlug,
  enabled = true,
  dependencies,
}: UseBunkerOperatorFeedOptions) {
  const browser = useMemo(
    () => dependencies === undefined ? browserDependencies(eventSlug) : null,
    [dependencies, eventSlug],
  );
  const deps = dependencies === undefined ? browser : dependencies;
  const [feed, setFeed] = useState<BunkerOperatorFeed | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(enabled && Boolean(deps));

  useEffect(() => {
    if (!enabled || !deps) {
      setFeed(null);
      setError('');
      setLoading(false);
      return undefined;
    }

    let alive = true;
    let inFlight: Promise<void> | null = null;
    let queued = false;
    let timer: number | null = null;
    let currentFeed: BunkerOperatorFeed | null = null;
    const pollIntervalMs = Math.max(500, deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);

    const clearPoll = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    };
    const schedulePoll = () => {
      clearPoll();
      if (!alive) return;
      timer = window.setTimeout(() => { void request(); }, pollIntervalMs);
    };
    const request = (): Promise<void> => {
      clearPoll();
      if (inFlight) {
        queued = true;
        return inFlight;
      }
      setLoading((value) => currentFeed === null ? true : value);
      const operation = deps.load()
        .then((next) => {
          if (!alive) return;
          currentFeed = next;
          setFeed((previous) => (
            previous?.message?.id && previous.message.id === next.message?.id
              ? { ...next, message: previous.message }
              : next
          ));
          setError('');
          schedulePoll();
        })
        .catch(() => {
          if (!alive) return;
          setError(FEED_ERROR);
          schedulePoll();
        })
        .finally(() => {
          if (inFlight === operation) inFlight = null;
          if (!alive) return;
          setLoading(false);
          if (queued) {
            queued = false;
            void request();
          }
        });
      inFlight = operation;
      return operation;
    };

    setFeed(null);
    setError('');
    setLoading(true);
    void request();
    const unsubscribe = deps.subscribe?.(() => { void request(); });
    const recover = () => { void request(); };
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);

    return () => {
      alive = false;
      queued = false;
      clearPoll();
      unsubscribe?.();
      window.removeEventListener('focus', recover);
      window.removeEventListener('online', recover);
    };
  }, [deps, enabled, eventSlug]);

  return { feed, error, loading };
}
