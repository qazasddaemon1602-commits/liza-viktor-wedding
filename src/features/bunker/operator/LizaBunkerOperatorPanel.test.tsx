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
