import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationCarriageMap } from './carriageMap.service';
import { ScreenPage, type ScreenPageDependencies } from './ScreenPage';
import type { ScreenPresentationEvent } from './screenEvents.realtime';

const makeMap = (
  status: RegistrationCarriageMap['status'],
  registeredGuestCount = status === 'complete' ? 2 : status === 'not_found' ? 0 : 1,
): RegistrationCarriageMap => ({
  status,
  expectedGuestCount: status === 'not_found' ? 0 : 2,
  registeredGuestCount,
  serverNow: '2026-08-30T10:00:00.000Z',
  unassignedCount: 0,
  carriages: status === 'not_found' ? [] : [
    {
      id: 'carriage-1',
      number: 1,
      label: 'ВАГОН №1',
      accentHex: '#31483A',
      visualMark: '01',
      guests: [{ id: 'guest-1', initials: 'АП', seatIndex: 1 }],
    },
    {
      id: 'carriage-2',
      number: 2,
      label: 'ВАГОН №2',
      accentHex: '#7E3F3C',
      visualMark: '02',
      guests: registeredGuestCount > 1
        ? [{ id: 'guest-2', initials: 'ВК', seatIndex: 1 }]
        : [],
    },
  ],
});

const guestRegisteredEvent: ScreenPresentationEvent = {
  id: 'registration-map-event-1',
  kind: 'guest_registered',
  createdAt: '2026-08-30T10:01:00.000Z',
  payload: {
    displayName: 'Анна Петрова',
    carriage: {
      id: 'carriage-1',
      number: 1,
      label: 'ВАГОН №1',
      accentHex: '#31483A',
      visualMark: '01',
    },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('ScreenPage registration carriage map', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads on entry but keeps QR primary while registration is authoritative', async () => {
    const loadCarriageMap = vi.fn().mockResolvedValue(makeMap('registration'));
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadCarriageMap,
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });

    expect(loadCarriageMap).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ОТКРЫТЬ КАРТУ СОСТАВА' })).toBeInTheDocument();
  });

  it('shows the live map when the owner console requests it', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushEvent = callback;
        return vi.fn();
      },
      loadCarriageMap: vi.fn().mockRejectedValue(new Error('PGRST202')),
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });

    act(() => pushEvent?.({
      id: 'map-show-1',
      kind: 'carriage_map_show',
      createdAt: '2026-08-30T10:00:01.000Z',
      payload: { map: makeMap('registration') },
    }));

    expect(screen.getByLabelText('Карта вагонов')).toBeInTheDocument();
  });

  it('refreshes the authoritative map after a guest registration signal', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const loadCarriageMap = vi.fn().mockResolvedValue(makeMap('registration'));
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushEvent = callback;
        return vi.fn();
      },
      loadCarriageMap,
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      pushEvent?.(guestRegisteredEvent);
      await Promise.resolve();
    });

    expect(loadCarriageMap).toHaveBeenCalledTimes(2);
  });

  it('polls every two seconds to converge owner carriage reassignments', async () => {
    const loadCarriageMap = vi.fn().mockResolvedValue(makeMap('registration'));
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadCarriageMap,
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      vi.advanceTimersByTime(1_999);
      await Promise.resolve();
    });
    expect(loadCarriageMap).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(loadCarriageMap).toHaveBeenCalledTimes(2);
  });

  it('never overlaps requests and coalesces refresh signals received in flight', async () => {
    let pushEvent: ((event: ScreenPresentationEvent) => void) | undefined;
    const first = deferred<RegistrationCarriageMap>();
    const loadCarriageMap = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(makeMap('registration'));
    const dependencies: ScreenPageDependencies = {
      subscribe: (callback) => {
        pushEvent = callback;
        return vi.fn();
      },
      loadCarriageMap,
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    expect(loadCarriageMap).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      pushEvent?.(guestRegisteredEvent);
      await Promise.resolve();
    });
    expect(loadCarriageMap).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(makeMap('registration'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(loadCarriageMap).toHaveBeenCalledTimes(2);
  });

  it('preserves the last valid map when a later refresh fails', async () => {
    const loadCarriageMap = vi.fn()
      .mockResolvedValueOnce(makeMap('registration'))
      .mockRejectedValueOnce(new Error('temporary network failure'));
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadCarriageMap,
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'ОТКРЫТЬ КАРТУ СОСТАВА' }));
    expect(screen.getByLabelText('Карта вагонов')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Карта вагонов')).toBeInTheDocument();
    expect(screen.getByText('ЗАРЕГИСТРИРОВАНО 1 ИЗ 2')).toBeInTheDocument();
  });

  it('only complete automatically replaces the QR with a full map', async () => {
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadCarriageMap: vi.fn().mockResolvedValue(makeMap('complete')),
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByTestId('registration-qr')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Карта вагонов')).toHaveAttribute('data-variant', 'full');
  });

  it('promotes a registration map automatically when polling reports completion', async () => {
    const loadCarriageMap = vi.fn()
      .mockResolvedValueOnce(makeMap('registration'))
      .mockResolvedValueOnce(makeMap('complete'));
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadCarriageMap,
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId('registration-qr')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Карта вагонов')).toHaveAttribute('data-variant', 'full');
  });

  it('keeps the existing idle scene for not_found', async () => {
    const dependencies: ScreenPageDependencies = {
      subscribe: () => vi.fn(),
      loadCarriageMap: vi.fn().mockResolvedValue(makeMap('not_found')),
    };

    render(<ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId('registration-qr')).toBeInTheDocument();
    expect(screen.queryByLabelText('Карта вагонов')).not.toBeInTheDocument();
  });

  it('cleans up the polling timer and ignores a request resolved after unmount', async () => {
    const pending = deferred<RegistrationCarriageMap>();
    const loadCarriageMap = vi.fn().mockReturnValue(pending.promise);
    const unsubscribe = vi.fn();
    const dependencies: ScreenPageDependencies = {
      subscribe: () => unsubscribe,
      loadCarriageMap,
    };

    const view = render(
      <ScreenPage joinUrl="https://wedding.example/join" dependencies={dependencies} />,
    );
    expect(loadCarriageMap).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      pending.resolve(makeMap('complete'));
      await Promise.resolve();
    });

    expect(loadCarriageMap).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
