import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBunkerOperatorFeed,
  parseBunkerOperatorFeed,
  useBunkerOperatorFeed,
} from './useBunkerOperatorFeed';

const firstFeed = {
  status: 'active' as const,
  active: true as const,
  globalGameState: 'MISSION_02',
  revealed: false,
  serverNow: '2026-08-23T12:00:46.000Z',
  message: {
    id: 'd0df34d4-40bf-4c50-aee5-c3b459bf93bf',
    stage: 'MISSION_02' as const,
    body: 'Сигнал слабый, но я вас слышу. Продолжайте.',
    source: 'fallback' as const,
    publishedAt: '2026-08-23T12:00:45.000Z',
  },
};

const secondFeed = {
  ...firstFeed,
  globalGameState: 'MISSION_04',
  serverNow: '2026-08-23T12:05:05.000Z',
  message: {
    id: 'a9ae29ec-ddea-4b39-ab32-80a97be57b86',
    stage: 'MISSION_04' as const,
    body: 'Один вагон не дойдёт. Держите связь.',
    source: 'selected' as const,
    publishedAt: '2026-08-23T12:05:04.000Z',
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Bunker operator public feed contract', () => {
  it('accepts the anonymous active RPC shape and rejects identity or catalog leaks', async () => {
    expect(parseBunkerOperatorFeed(firstFeed)).toEqual(firstFeed);
    expect(() => parseBunkerOperatorFeed({ ...firstFeed, lizaName: 'Лиза' })).toThrow(
      'Unexpected bunker operator feed response',
    );
    expect(() => parseBunkerOperatorFeed({
      ...firstFeed,
      message: { ...firstFeed.message, body: 'Секретная новая подсказка' },
    })).toThrow('Unexpected bunker operator feed response');

    const rpc = vi.fn().mockResolvedValue({ data: firstFeed, error: null });
    await expect(getBunkerOperatorFeed({ rpc }, 'liza-viktor')).resolves.toEqual(firstFeed);
    expect(rpc).toHaveBeenCalledWith('get_bunker_operator_feed', { p_event_slug: 'liza-viktor' });
  });
});

describe('useBunkerOperatorFeed', () => {
  it('loads immediately, refreshes from the shared subscription and polls only while active', async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockResolvedValueOnce(firstFeed)
      .mockResolvedValueOnce(secondFeed)
      .mockResolvedValue(secondFeed);
    let refresh: (() => void) | undefined;
    const unsubscribe = vi.fn();

    const dependencies = {
      load,
      subscribe: (callback: () => void) => { refresh = callback; return unsubscribe; },
      pollIntervalMs: 2_000,
    };
    const { result, unmount } = renderHook(() => useBunkerOperatorFeed({
      eventSlug: 'liza-viktor', dependencies,
    }));

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.feed?.message?.id).toBe(firstFeed.message.id);

    await act(async () => {
      refresh?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.feed?.message?.id).toBe(secondFeed.message.id);

    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    expect(load).toHaveBeenCalledTimes(3);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('coalesces overlapping invalidations, keeps the last valid feed on failure and ignores an old session', async () => {
    const oldRequest = deferred<typeof firstFeed>();
    const newRequest = deferred<typeof secondFeed>();
    let refresh: (() => void) | undefined;
    const oldLoad = vi.fn().mockReturnValue(oldRequest.promise);
    const newLoad = vi.fn().mockReturnValueOnce(newRequest.promise);
    const oldDependencies = {
      load: oldLoad,
      subscribe: (callback: () => void) => { refresh = callback; return () => undefined; },
    };
    const newDependencies = {
      load: newLoad,
      subscribe: (callback: () => void) => { refresh = callback; return () => undefined; },
    };
    const { result, rerender } = renderHook(
      ({ slug, dependencies }) => useBunkerOperatorFeed({
        eventSlug: slug,
        dependencies,
      }),
      { initialProps: { slug: 'old-event', dependencies: oldDependencies } },
    );

    act(() => {
      refresh?.();
      refresh?.();
    });
    expect(oldLoad).toHaveBeenCalledTimes(1);

    rerender({ slug: 'new-event', dependencies: newDependencies });
    await act(async () => { newRequest.resolve(secondFeed); });
    await waitFor(() => expect(result.current.feed?.message?.id).toBe(secondFeed.message.id));

    await act(async () => { oldRequest.resolve(firstFeed); });
    expect(result.current.feed?.message?.id).toBe(secondFeed.message.id);

    newLoad.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { refresh?.(); await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(result.current.error).toBe('Не удалось обновить канал оператора.'));
    expect(result.current.feed?.message?.id).toBe(secondFeed.message.id);
  });

  it('preserves the message object for repeated snapshots with the same id', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce(firstFeed)
      .mockResolvedValue({ ...firstFeed, serverNow: '2026-08-23T12:00:48.000Z' });
    let refresh: (() => void) | undefined;
    const dependencies = {
      load,
      subscribe: (callback: () => void) => { refresh = callback; return () => undefined; },
    };
    const { result } = renderHook(() => useBunkerOperatorFeed({
      eventSlug: 'liza-viktor',
      dependencies,
    }));
    await waitFor(() => expect(result.current.feed).not.toBeNull());
    const firstMessage = result.current.feed?.message;
    await act(async () => { refresh?.(); await Promise.resolve(); });
    await waitFor(() => expect(result.current.feed?.serverNow).toBe('2026-08-23T12:00:48.000Z'));
    expect(result.current.feed?.message).toBe(firstMessage);
  });

  it('retries an initial transient failure while the surrounding Bunker session stays active', async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(firstFeed);
    const dependencies = { load, pollIntervalMs: 2_000 };
    const { result } = renderHook(() => useBunkerOperatorFeed({
      eventSlug: 'liza-viktor', enabled: true, dependencies,
    }));

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.feed).toBeNull();
    expect(result.current.error).toBe('Не удалось обновить канал оператора.');

    await act(async () => { await vi.advanceTimersByTimeAsync(2_100); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.feed?.message?.id).toBe(firstFeed.message.id);
  });
});
