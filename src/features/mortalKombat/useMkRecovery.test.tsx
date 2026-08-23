import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMkRecovery } from './useMkRecovery';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useMkRecovery', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads immediately and routes polling, realtime, focus, online and visible recovery through refresh', async () => {
    let realtimeRefresh: (() => void) | undefined;
    const load = vi.fn().mockResolvedValue({ revision: 1 });
    renderHook(() => useMkRecovery({
      scopeKey: 'event-1',
      load,
      subscribe: (callback) => {
        realtimeRefresh = callback;
        return vi.fn();
      },
      pollIntervalMs: 100,
    }));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    act(() => realtimeRefresh?.()); await settle();
    window.dispatchEvent(new Event('focus')); await settle();
    window.dispatchEvent(new Event('online')); await settle();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange')); await settle();

    expect(load).toHaveBeenCalledTimes(6);
  });

  it('coalesces overlap into one trailing request', async () => {
    const first = deferred<{ revision: number }>();
    const second = deferred<{ revision: number }>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useMkRecovery({ scopeKey: 'event-1', load, pollIntervalMs: 5_000 }));

    await settle();
    act(() => {
      result.current.requestRefresh();
      result.current.requestRefresh();
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => { first.resolve({ revision: 1 }); await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve({ revision: 2 }); await Promise.resolve(); });
    expect(result.current.state).toEqual({ revision: 2 });
  });

  it('invalidates an old response and commits only the owner-triggered trailing reload', async () => {
    const oldLoad = deferred<{ revision: number }>();
    const freshLoad = deferred<{ revision: number }>();
    const load = vi.fn().mockReturnValueOnce(oldLoad.promise).mockReturnValueOnce(freshLoad.promise);
    const { result } = renderHook(() => useMkRecovery({ scopeKey: 'event-1', load, pollIntervalMs: 5_000 }));

    await settle();
    act(() => result.current.invalidate());
    await act(async () => { oldLoad.resolve({ revision: 1 }); await Promise.resolve(); });
    expect(result.current.state).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => { freshLoad.resolve({ revision: 2 }); await Promise.resolve(); });
    expect(result.current.state).toEqual({ revision: 2 });
  });

  it('preserves the last valid state while stale and clears stale after recovery', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ revision: 1 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ revision: 2 });
    const { result } = renderHook(() => useMkRecovery({ scopeKey: 'event-1', load, pollIntervalMs: 5_000 }));
    await settle();

    await act(async () => { result.current.requestRefresh(); await Promise.resolve(); });
    expect(result.current.state).toEqual({ revision: 1 });
    expect(result.current.stale).toBe(true);

    await act(async () => { result.current.requestRefresh(); await Promise.resolve(); });
    expect(result.current.state).toEqual({ revision: 2 });
    expect(result.current.stale).toBe(false);
  });

  it('resets scope and removes polling, subscriptions and browser listeners on unmount', async () => {
    const unsubscribe = vi.fn();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const load = vi.fn().mockResolvedValue({ revision: 1 });
    const { result, rerender, unmount } = renderHook(
      ({ scopeKey }) => useMkRecovery({ scopeKey, load, subscribe: () => unsubscribe, pollIntervalMs: 5_000 }),
      { initialProps: { scopeKey: 'event-1' } },
    );
    await settle();
    expect(result.current.state).toEqual({ revision: 1 });

    rerender({ scopeKey: 'event-2' });
    expect(result.current.state).toBeNull();
    await settle();
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
  });
});
