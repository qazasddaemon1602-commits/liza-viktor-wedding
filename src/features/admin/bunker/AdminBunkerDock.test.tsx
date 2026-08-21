import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminDashboard } from '../admin.service';
import type { AdminBunkerControlDependencies } from './AdminBunkerControl';
import { AdminBunkerDock } from './AdminBunkerDock';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function dashboard({
  wagonCount,
  guestCount,
  locked,
}: {
  wagonCount: number;
  guestCount: number;
  locked: boolean;
}): AdminDashboard {
  const carriages = Array.from({ length: 5 }, (_, index) => ({
    id: `carriage-${index + 1}`,
    number: index + 1,
    label: `ВАГОН №${index + 1}`,
    accentHex: '#33483a',
    visualMark: `0${index + 1}`,
    enabled: index < wagonCount,
  }));
  return {
    status: 'owner',
    event: {
      id: 'event-1', slug: 'liza-viktor', name: 'Лиза & Виктор',
      weddingDate: '2026-08-30', eventDate: '2026-08-30', expectedGuestCount: 40,
      registrationOpen: true, compositionLocked: locked, nextTicketSequence: guestCount + 1,
    },
    state: null,
    carriages,
    guests: Array.from({ length: guestCount }, (_, index) => {
      const carriage = carriages[index % wagonCount]!;
      return {
        id: `guest-${index + 1}`, firstName: 'Гость', lastName: String(index + 1),
        affiliationType: 'common', affiliationDetail: '', ticketNumber: `LV-${index + 1}`,
        registeredAt: '2026-08-30T11:00:00.000Z', lastSeenAt: '2026-08-30T11:00:00.000Z',
        carriage,
      };
    }),
    recentActions: [],
  };
}

function bunkerControlDependencies(): AdminBunkerControlDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'idle', durationSeconds: 1800, soundEnabled: true,
      serverNow: '2026-08-30T12:00:00.000Z',
    }),
    prepare: vi.fn().mockResolvedValue({
      status: 'prepared', eventId: 'event-1',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'LOBBY', gameMode: 'production', wagonCount: 4, guestCount: 32,
    }),
    distribute: vi.fn().mockResolvedValue({
      status: 'characters_ready',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY', assignedCount: 32, wagonCount: 4,
    }),
    start: vi.fn().mockResolvedValue({ status: 'active' }),
    stop: vi.fn().mockResolvedValue({ status: 'idle' }),
    setSound: vi.fn().mockResolvedValue({ status: 'updated' }),
    broadcastRefresh: vi.fn().mockResolvedValue(undefined),
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => vi.useRealTimers());

describe('AdminBunkerDock dashboard scheduling', () => {
  it('loads authoritative M01 owner instances and forwards a reason-bound override', async () => {
    const loadMissionOne = vi.fn().mockResolvedValue({
      contractVersion: 2,
      status: 'active',
      serverNow: '2026-08-30T12:00:01.000Z',
      deadlineAt: '2026-08-30T12:04:00.000Z',
      wagons: [{
        wagonId: 'carriage-1',
        instanceId: '41000000-0000-4000-8000-000000000010',
        instanceVersion: 1,
        label: 'ВАГОН №1',
        quota: 1,
        status: 'completed',
        selectedGuestIds: ['guest-1'],
        members: [
          { guestId: 'guest-1', realName: 'Александра-Мария Константинопольская', profession: 'Инженер' },
          { guestId: 'guest-2', realName: 'Николай Добровольский', profession: 'Картограф' },
        ],
      }],
    });
    const overrideMissionOne = vi.fn().mockResolvedValue({
      contractVersion: 2,
      status: 'accepted',
      commandId: '41000000-0000-4000-8000-000000000020',
      commandType: 'owner_m01_override',
    });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const control = bunkerControlDependencies();
    control.load = vi.fn().mockResolvedValue({
      status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
      remainingSeconds: 239, soundEnabled: false, globalGameState: 'MISSION_01',
      currentMission: { id: 'mission-01', state: 'MISSION_01', plan: null },
      serverNow: '2026-08-30T12:00:01.000Z',
    });

    render(
      <AdminBunkerDock
        dependencies={{
          loadDashboard: vi.fn().mockResolvedValue(dashboard({ wagonCount: 2, guestCount: 12, locked: true })),
          applyDistribution: vi.fn(),
          bunkerControl: control,
          loadMissionOne,
          overrideMissionOne,
          broadcastRefresh,
        }}
      />,
    );
    await flushPromises();

    expect(await screen.findByRole('heading', { name: 'ЛИШНИЙ ПАССАЖИР' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ИЗМЕНИТЬ РЕШЕНИЕ · ВАГОН №1' }));
    const form = screen.getByRole('form', { name: 'Override · ВАГОН №1' });
    fireEvent.click(within(form).getByRole('checkbox', { name: /александра-мария/i }));
    fireEvent.click(within(form).getByRole('checkbox', { name: /николай добровольский/i }));
    fireEvent.change(within(form).getByRole('textbox', { name: 'Причина изменения' }), {
      target: { value: 'Исправляем подтверждённую ошибку команды' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'ПРИМЕНИТЬ OVERRIDE' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Подтвердите изменение решения' }))
        .getByRole('button', { name: 'ПОДТВЕРДИТЬ OVERRIDE' }),
    );
    await flushPromises();

    expect(overrideMissionOne).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      instanceId: '41000000-0000-4000-8000-000000000010',
      instanceVersion: 1,
      selectedGuestIds: ['guest-2'],
      reason: 'Исправляем подтверждённую ошибку команды',
    }));
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
    expect(loadMissionOne).toHaveBeenCalledTimes(2);
  });

  it('refreshes owner M01 progress immediately on focus and online recovery', async () => {
    const loadDashboard = vi.fn().mockResolvedValue(
      dashboard({ wagonCount: 2, guestCount: 15, locked: true }),
    );
    const loadMissionOne = vi.fn().mockResolvedValue({
      contractVersion: 2, status: 'idle', serverNow: '2026-08-30T12:00:01.000Z',
    });
    render(
      <AdminBunkerDock dependencies={{
        loadDashboard,
        applyDistribution: vi.fn(),
        bunkerControl: bunkerControlDependencies(),
        loadMissionOne,
      }} />,
    );
    await flushPromises();
    expect(loadMissionOne).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event('focus')));
    await flushPromises();
    act(() => window.dispatchEvent(new Event('online')));
    await flushPromises();

    expect(loadDashboard).toHaveBeenCalledTimes(3);
    expect(loadMissionOne).toHaveBeenCalledTimes(3);
  });

  it('fails closed and removes owner-only counts when the latest dashboard read loses access', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    const loadDashboard = vi.fn()
      .mockResolvedValueOnce(dashboard({ wagonCount: 3, guestCount: 20, locked: true }))
      .mockRejectedValueOnce(new Error('JWT expired'));

    render(
      <AdminBunkerDock
        dependencies={{
          loadDashboard,
          applyDistribution: vi.fn(),
          bunkerControl: bunkerControlDependencies(),
        }}
      />,
    );
    await flushPromises();

    expect(screen.getByRole('heading', { name: 'БУНКЕР' })).toBeInTheDocument();
    expect(screen.getByText('OWNER-ДАННЫЕ ПОДТВЕРЖДЕНЫ')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole('heading', { name: 'БУНКЕР' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Сводка по вагонам' })).not.toBeInTheDocument();
    expect(screen.queryByText('OWNER-ДАННЫЕ ПОДТВЕРЖДЕНЫ')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('OWNER-ДАННЫЕ НЕДОСТУПНЫ');
    expect(screen.getByRole('status')).toHaveTextContent('ПУЛЬТ СКРЫТ');
  });

  it('polls on a stable 15 second cadence and coalesces while a poll is still in flight', async () => {
    vi.useFakeTimers();
    const pendingPoll = deferred<AdminDashboard>();
    const loadDashboard = vi.fn()
      .mockResolvedValueOnce(dashboard({ wagonCount: 3, guestCount: 20, locked: true }))
      .mockImplementationOnce(() => pendingPoll.promise);

    render(
      <AdminBunkerDock
        dependencies={{
          loadDashboard,
          applyDistribution: vi.fn(),
          bunkerControl: bunkerControlDependencies(),
        }}
      />,
    );
    await flushPromises();

    expect(loadDashboard).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(14_999));
    expect(loadDashboard).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTime(1));
    expect(loadDashboard).toHaveBeenCalledTimes(2);

    await act(async () => vi.advanceTimersByTime(15_000));
    expect(loadDashboard).toHaveBeenCalledTimes(2);
    pendingPoll.resolve(dashboard({ wagonCount: 3, guestCount: 21, locked: true }));
    await flushPromises();
  });

  it('keeps the post-distribution dashboard when an older poll resolves afterward', async () => {
    vi.useFakeTimers();
    const stalePoll = deferred<AdminDashboard>();
    const postCommand = deferred<AdminDashboard>();
    const loadDashboard = vi.fn()
      .mockResolvedValueOnce(dashboard({ wagonCount: 5, guestCount: 20, locked: false }))
      .mockImplementationOnce(() => stalePoll.promise)
      .mockImplementationOnce(() => postCommand.promise);
    const applyDistribution = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminBunkerDock
        dependencies={{
          loadDashboard,
          applyDistribution,
          bunkerControl: bunkerControlDependencies(),
        }}
      />,
    );
    await flushPromises();
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(loadDashboard).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'ПРИНЯТЬ СХЕМУ · 3 ВАГОНА' }));
    await flushPromises();
    expect(applyDistribution).toHaveBeenCalledWith('event-1', 3);
    expect(loadDashboard).toHaveBeenCalledTimes(3);

    postCommand.resolve(dashboard({ wagonCount: 3, guestCount: 20, locked: true }));
    await flushPromises();
    expect(within(screen.getByRole('list', { name: 'Сводка по вагонам' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /ПРИНЯТЬ СХЕМУ/ })).not.toBeInTheDocument();

    stalePoll.resolve(dashboard({ wagonCount: 5, guestCount: 20, locked: false }));
    await flushPromises();
    expect(within(screen.getByRole('list', { name: 'Сводка по вагонам' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /ПРИНЯТЬ СХЕМУ/ })).not.toBeInTheDocument();
  });

  it('starts a later interval read after distribution invalidates a hung older poll', async () => {
    vi.useFakeTimers();
    const staleHungPoll = deferred<AdminDashboard>();
    const laterPoll = deferred<AdminDashboard>();
    const loadDashboard = vi.fn()
      .mockResolvedValueOnce(dashboard({ wagonCount: 5, guestCount: 20, locked: false }))
      .mockImplementationOnce(() => staleHungPoll.promise)
      .mockResolvedValueOnce(dashboard({ wagonCount: 3, guestCount: 20, locked: true }))
      .mockImplementationOnce(() => laterPoll.promise);

    render(
      <AdminBunkerDock
        dependencies={{
          loadDashboard,
          applyDistribution: vi.fn().mockResolvedValue(undefined),
          bunkerControl: bunkerControlDependencies(),
        }}
      />,
    );
    await flushPromises();

    await act(async () => vi.advanceTimersByTime(15_000));
    expect(loadDashboard).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'ПРИНЯТЬ СХЕМУ · 3 ВАГОНА' }));
    await flushPromises();
    expect(loadDashboard).toHaveBeenCalledTimes(3);
    expect(within(screen.getByRole('list', { name: 'Сводка по вагонам' })).getAllByRole('listitem')).toHaveLength(3);

    await act(async () => vi.advanceTimersByTime(15_000));
    expect(loadDashboard).toHaveBeenCalledTimes(4);

    laterPoll.resolve(dashboard({ wagonCount: 3, guestCount: 21, locked: true }));
    await flushPromises();
    expect(screen.getByText('21')).toBeInTheDocument();

    staleHungPoll.resolve(dashboard({ wagonCount: 5, guestCount: 20, locked: false }));
    await flushPromises();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Сводка по вагонам' })).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /ПРИНЯТЬ СХЕМУ/ })).not.toBeInTheDocument();
  });
});
