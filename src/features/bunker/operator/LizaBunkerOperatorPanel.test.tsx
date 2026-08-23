import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LizaBunkerOperatorPanel,
  type LizaBunkerOperatorPanelDependencies,
} from './LizaBunkerOperatorPanel';
import type { LizaBunkerOperatorState } from './bunkerOperator.service';

const activeState: Extract<LizaBunkerOperatorState, { status: 'active' }> = {
  status: 'active', bunkerActive: true, globalGameState: 'MISSION_02', stage: 'MISSION_02',
  enteredAt: '2026-08-23T12:00:00.000Z', sendUntil: '2026-08-23T12:00:45.000Z',
  serverNow: '2026-08-23T12:00:05.000Z', windowOpen: true,
  options: [
    { key: 'm02_signal', body: 'Сигнал слабый, но я вас слышу. Продолжайте.' },
    { key: 'm02_fragments', body: 'Не доверяйте одному фрагменту. Сверяйте всё, что нашли.' },
  ], selectedMessage: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function selectedState(messageId = 'message-1'): Extract<LizaBunkerOperatorState, { status: 'active' }> {
  return {
    ...activeState,
    serverNow: '2026-08-23T12:00:07.000Z',
    windowOpen: false,
    selectedMessage: {
      id: messageId, stage: 'MISSION_02', optionKey: 'm02_signal',
      body: activeState.options[0].body, source: 'selected', publishedAt: '2026-08-23T12:00:06.000Z',
    },
  };
}

function deps(overrides: Partial<LizaBunkerOperatorPanelDependencies> = {}): LizaBunkerOperatorPanelDependencies {
  return {
    load: vi.fn().mockResolvedValue(activeState),
    submit: vi.fn().mockResolvedValue({
      status: 'accepted', serverNow: '2026-08-23T12:00:06.000Z',
      message: { id: 'message-1', stage: 'MISSION_02', optionKey: 'm02_signal',
        body: activeState.options[0].body, source: 'selected', publishedAt: '2026-08-23T12:00:06.000Z' },
    }),
    subscribe: vi.fn(() => vi.fn()),
    broadcast: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe('LizaBunkerOperatorPanel', () => {
  it('renders the anonymous private channel with exactly two phrase options and no game controls', () => {
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={deps()} />);
    expect(screen.getByText('ОПЕРАТОР BK-17 · PRIVATE CHANNEL')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Сигнал слабый|Не доверяйте/ })).toHaveLength(2);
    expect(screen.queryByText(/Лиза/)).not.toBeInTheDocument();
    expect(screen.queryByText(/баланс|очки|сч[её]т/i)).not.toBeInTheDocument();
    expect(screen.getByText('00:40')).toBeInTheDocument();
  });

  it('confirms the exact phrase, submits once, locks the card and broadcasts refresh', async () => {
    const dependencies = deps({ broadcast: vi.fn().mockRejectedValue(new Error('realtime offline')) });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: activeState.options[0].body }));
    expect(screen.getByText('ПОДТВЕРДИТЕ ПЕРЕДАЧУ')).toBeInTheDocument();
    const transmit = screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' });
    fireEvent.click(transmit);
    fireEvent.click(transmit);
    await waitFor(() => expect(dependencies.submit).toHaveBeenCalledTimes(1));
    expect(dependencies.submit).toHaveBeenCalledWith('secret', 'MISSION_02', 'm02_signal');
    expect(await screen.findByText('СИГНАЛ ПЕРЕДАН')).toBeInTheDocument();
    expect(dependencies.broadcast).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Сигнал слабый|Не доверяйте/ })[0]).toBeDisabled();
  });

  it('shows deterministic fallback when the send window was missed', () => {
    render(<LizaBunkerOperatorPanel token="secret" initialState={{
      ...activeState, windowOpen: false,
      selectedMessage: { id: 'fallback-1', stage: 'MISSION_02', optionKey: 'm02_signal',
        body: activeState.options[0].body, source: 'fallback', publishedAt: activeState.sendUntil },
    }} dependencies={deps()} />);
    expect(screen.getByText('КАНАЛ ПЕРЕДАЛ РЕЗЕРВНОЕ СООБЩЕНИЕ')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Сигнал слабый|Не доверяйте/ }).every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('keeps the option open at 44.999 and disables it exactly at the 45-second deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T15:00:00.000Z'));
    render(<LizaBunkerOperatorPanel token="secret" initialState={{
      ...activeState, serverNow: '2026-08-23T12:00:44.999Z',
    }} dependencies={deps()} />);
    const option = screen.getByRole('button', { name: activeState.options[0].body });
    expect(screen.getByText('00:01')).toBeInTheDocument();
    expect(option).toBeEnabled();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(option).toBeDisabled();
  });

  it.each(['accepted', 'locked'] as const)('never rolls back a %s submit when an older load resolves late', async (status) => {
    const stale = deferred<LizaBunkerOperatorState>();
    let refresh: (() => void) | undefined;
    const load = vi.fn()
      .mockImplementationOnce(() => stale.promise)
      .mockResolvedValue(selectedState(`${status}-authoritative`));
    const submit = vi.fn().mockResolvedValue({
      status, serverNow: '2026-08-23T12:00:06.000Z', message: selectedState(`${status}-local`).selectedMessage!,
    });
    const dependencies = deps({
      load, submit,
      subscribe: vi.fn((callback) => { refresh = callback; return vi.fn(); }),
    });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    act(() => refresh?.());
    fireEvent.click(screen.getByRole('button', { name: activeState.options[0].body }));
    fireEvent.click(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' }));
    expect(await screen.findByText('СИГНАЛ ПЕРЕДАН')).toBeInTheDocument();

    await act(async () => { stale.resolve(activeState); await stale.promise; await Promise.resolve(); });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(screen.getByText('СИГНАЛ ПЕРЕДАН')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Сигнал слабый|Не доверяйте/ }).every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('keeps an accepted local lock when the authoritative reload loses the network', async () => {
    const dependencies = deps({ load: vi.fn().mockRejectedValue(new Error('offline after commit')) });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: activeState.options[0].body }));
    fireEvent.click(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' }));
    expect(await screen.findByText('СИГНАЛ ПЕРЕДАН')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Последний принятый сигнал сохранён');
    expect(screen.getByRole('button', { name: activeState.options[0].body })).toBeDisabled();
  });

  it('does not let a submit result roll a later revealed transition back to an active stage', async () => {
    const pendingSubmit = deferred<Awaited<ReturnType<LizaBunkerOperatorPanelDependencies['submit']>>>();
    let refresh: (() => void) | undefined;
    const revealed: LizaBunkerOperatorState = {
      status: 'revealed', bunkerActive: true, globalGameState: 'BUNKER_OPEN', serverNow: '2026-08-23T12:01:00Z',
    };
    const dependencies = deps({
      load: vi.fn().mockResolvedValue(revealed),
      submit: vi.fn(() => pendingSubmit.promise),
      subscribe: vi.fn((callback) => { refresh = callback; return vi.fn(); }),
    });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: activeState.options[0].body }));
    fireEvent.click(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' }));
    await act(async () => { refresh?.(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('СИГНАЛ ПРИНЯТ')).toBeInTheDocument();
    await act(async () => {
      pendingSubmit.resolve({
        status: 'accepted', serverNow: '2026-08-23T12:00:06.000Z', message: selectedState().selectedMessage!,
      });
      await pendingSubmit.promise;
    });
    expect(screen.getByText('СИГНАЛ ПРИНЯТ')).toBeInTheDocument();
    expect(screen.queryByText('ВЫБЕРИТЕ СИГНАЛ')).not.toBeInTheDocument();
  });

  it('keeps the choice available for retry after a submit error', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      status: 'accepted', serverNow: '2026-08-23T12:00:07.000Z',
      message: { id: 'message-2', stage: 'MISSION_02', optionKey: 'm02_fragments',
        body: activeState.options[1].body, source: 'selected', publishedAt: '2026-08-23T12:00:07.000Z' },
    });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={deps({ submit })} />);
    fireEvent.click(screen.getByRole('button', { name: activeState.options[1].body }));
    fireEvent.click(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Сигнал не передан');
    expect(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' }));
    expect(await screen.findByText('СИГНАЛ ПЕРЕДАН')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('keeps the last valid operator view during a transient load error', async () => {
    let refresh: (() => void) | undefined;
    const dependencies = deps({
      load: vi.fn().mockRejectedValue(new Error('offline')),
      subscribe: vi.fn((callback) => { refresh = callback; return vi.fn(); }),
    });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    await act(async () => { refresh?.(); await Promise.resolve(); await Promise.resolve(); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Последний принятый сигнал сохранён');
    expect(screen.getByText('ВЫБЕРИТЕ СИГНАЛ')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Сигнал слабый|Не доверяйте/ })).toHaveLength(2);
  });

  it.each([
    [{ status: 'idle', bunkerActive: true, globalGameState: 'MISSION_03', serverNow: '2026-08-23T12:01:00Z' }, 'СОСТАВ В ПУТИ'],
    [{ status: 'revealed', bunkerActive: true, globalGameState: 'BUNKER_OPEN', serverNow: '2026-08-23T12:01:00Z' }, 'СИГНАЛ ПРИНЯТ'],
    [{ status: 'finished', bunkerActive: true, globalGameState: 'FINISHED', serverNow: '2026-08-23T12:01:00Z' }, 'МАРШРУТ ЗАВЕРШЁН'],
    [{ status: 'invalid_access' }, 'ССЫЛКА НЕДЕЙСТВИТЕЛЬНА'],
  ] as const)('renders an authoritative transition to %s', async (next, copy) => {
    let refresh: (() => void) | undefined;
    const dependencies = deps({
      load: vi.fn().mockResolvedValue(next),
      subscribe: vi.fn((callback) => { refresh = callback; return vi.fn(); }),
    });
    render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    await act(async () => { refresh?.(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText(copy)).toBeInTheDocument();
  });

  it('isolates late loads after a token and dependency session switch', async () => {
    const oldLoad = deferred<LizaBunkerOperatorState>();
    let oldRefresh: (() => void) | undefined;
    const oldUnsubscribe = vi.fn();
    const oldDependencies = deps({
      load: vi.fn(() => oldLoad.promise),
      subscribe: vi.fn((callback) => { oldRefresh = callback; return oldUnsubscribe; }),
    });
    const nextState: LizaBunkerOperatorState = {
      status: 'finished', bunkerActive: true, globalGameState: 'FINISHED', serverNow: '2026-08-23T12:02:00Z',
    };
    const newDependencies = deps({ load: vi.fn().mockResolvedValue(nextState) });
    const view = render(<LizaBunkerOperatorPanel token="old-token" initialState={activeState} dependencies={oldDependencies} />);
    act(() => oldRefresh?.());
    view.rerender(<LizaBunkerOperatorPanel token="new-token" initialState={nextState} dependencies={newDependencies} />);
    expect(screen.getByText('МАРШРУТ ЗАВЕРШЁН')).toBeInTheDocument();
    await act(async () => { oldLoad.resolve({ status: 'invalid_access' }); await oldLoad.promise; await Promise.resolve(); });
    expect(screen.getByText('МАРШРУТ ЗАВЕРШЁН')).toBeInTheDocument();
    expect(screen.queryByText('ССЫЛКА НЕДЕЙСТВИТЕЛЬНА')).not.toBeInTheDocument();
    expect(oldUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'] as const)('isolates a late submit %s after a token session switch', async (settlement) => {
    const oldSubmit = deferred<Awaited<ReturnType<LizaBunkerOperatorPanelDependencies['submit']>>>();
    const oldDependencies = deps({ submit: vi.fn(() => oldSubmit.promise) });
    const nextState: LizaBunkerOperatorState = {
      status: 'finished', bunkerActive: true, globalGameState: 'FINISHED', serverNow: '2026-08-23T12:02:00Z',
    };
    const view = render(<LizaBunkerOperatorPanel token="old-token" initialState={activeState} dependencies={oldDependencies} />);
    fireEvent.click(screen.getByRole('button', { name: activeState.options[0].body }));
    fireEvent.click(screen.getByRole('button', { name: 'ПЕРЕДАТЬ В СОСТАВ' }));
    view.rerender(<LizaBunkerOperatorPanel token="new-token" initialState={nextState} dependencies={deps()} />);
    expect(screen.getByText('МАРШРУТ ЗАВЕРШЁН')).toBeInTheDocument();
    await act(async () => {
      if (settlement === 'resolve') {
        oldSubmit.resolve({
          status: 'accepted', serverNow: '2026-08-23T12:00:06.000Z', message: selectedState().selectedMessage!,
        });
      } else {
        oldSubmit.reject(new Error('old token rejected'));
      }
      try { await oldSubmit.promise; } catch { /* expected rejected branch */ }
      await Promise.resolve();
    });
    expect(screen.getByText('МАРШРУТ ЗАВЕРШЁН')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('СИГНАЛ ПЕРЕДАН')).not.toBeInTheDocument();
  });

  it('coalesces polling and refresh loads, keeps the last valid view on error, and cleans up', async () => {
    vi.useFakeTimers();
    let refresh: (() => void) | undefined;
    let resolveLoad: ((state: LizaBunkerOperatorState) => void) | undefined;
    const load = vi.fn(() => new Promise<LizaBunkerOperatorState>((resolve) => { resolveLoad = resolve; }));
    const unsubscribe = vi.fn();
    const dependencies = deps({ load, subscribe: vi.fn((callback) => { refresh = callback; return unsubscribe; }) });
    const view = render(<LizaBunkerOperatorPanel token="secret" initialState={activeState} dependencies={dependencies} />);
    fireEvent.click(screen.getByRole('button', { name: activeState.options[1].body }));

    act(() => { vi.advanceTimersByTime(2_000); refresh?.(); refresh?.(); });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { resolveLoad?.(activeState); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(2_000); await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.getByText('ОПЕРАТОР BK-17 · PRIVATE CHANNEL')).toBeInTheDocument();
    expect(screen.getByText('ПОДТВЕРДИТЕ ПЕРЕДАЧУ')).toBeInTheDocument();
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(4_000));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
