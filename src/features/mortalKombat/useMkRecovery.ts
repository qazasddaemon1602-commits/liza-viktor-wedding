import { useCallback, useEffect, useRef, useState } from 'react';

export type MkRecoveryOptions<T> = {
  scopeKey: string;
  load: () => Promise<T>;
  subscribe?: (callback: () => void) => () => void;
  pollIntervalMs?: number;
};

export type MkRecoveryResult<T> = {
  state: T | null;
  stale: boolean;
  requestRefresh: () => void;
  invalidate: () => void;
};

const DEFAULT_POLL_INTERVAL_MS = 5_000;

export function useMkRecovery<T>({
  scopeKey,
  load,
  subscribe,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: MkRecoveryOptions<T>): MkRecoveryResult<T> {
  const [state, setState] = useState<T | null>(null);
  const [stale, setStale] = useState(false);
  const loadRef = useRef(load);
  const subscribeRef = useRef(subscribe);
  const requestRef = useRef<() => void>(() => undefined);
  const invalidateRef = useRef<() => void>(() => undefined);
  loadRef.current = load;
  subscribeRef.current = subscribe;

  const requestRefresh = useCallback(() => requestRef.current(), []);
  const invalidate = useCallback(() => invalidateRef.current(), []);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let inFlight = false;
    let trailing = false;

    setState(null);
    setStale(false);

    const request = () => {
      if (!active) return;
      if (inFlight) {
        trailing = true;
        return;
      }

      inFlight = true;
      const requestGeneration = generation;
      void Promise.resolve()
        .then(() => loadRef.current())
        .then((next) => {
          if (!active || requestGeneration !== generation) return;
          setState(next);
          setStale(false);
        })
        .catch(() => {
          if (!active || requestGeneration !== generation) return;
          setStale(true);
        })
        .finally(() => {
          inFlight = false;
          if (!active || !trailing) return;
          trailing = false;
          request();
        });
    };

    requestRef.current = request;
    invalidateRef.current = () => {
      if (!active) return;
      generation += 1;
      request();
    };

    const requestWhenVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    window.addEventListener('focus', request);
    window.addEventListener('online', request);
    document.addEventListener('visibilitychange', requestWhenVisible);
    const unsubscribe = subscribeRef.current?.(request);
    const interval = window.setInterval(request, pollIntervalMs);
    request();

    return () => {
      active = false;
      generation += 1;
      trailing = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', request);
      window.removeEventListener('online', request);
      document.removeEventListener('visibilitychange', requestWhenVisible);
      unsubscribe?.();
      if (requestRef.current === request) requestRef.current = () => undefined;
    };
  }, [pollIntervalMs, scopeKey]);

  return { state, stale, requestRefresh, invalidate };
}
