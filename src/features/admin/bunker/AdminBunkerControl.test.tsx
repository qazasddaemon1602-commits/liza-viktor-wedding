import { act, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminDashboard } from '../admin.service';
import type { OwnerBunkerQuestDependencies } from '../../bunker/useOwnerBunkerQuestState';
import { PREMIERE_SCREEN_PRESENCE_TTL_MS } from '../../premiere/premierePresence';
import {
  AdminBunkerControl as ProductionAdminBunkerControl,
  type AdminBunkerControlDependencies,
} from './AdminBunkerControl';

type TestAdminBunkerControlProps = Omit<
  ComponentProps<typeof ProductionAdminBunkerControl>,
  'eventSlug'
> & { eventSlug?: string };

function AdminBunkerControl(props: TestAdminBunkerControlProps) {
  return <ProductionAdminBunkerControl eventSlug="liza-viktor" {...props} />;
}

function dependencies(overrides: Partial<AdminBunkerControlDependencies> = {}): AdminBunkerControlDependencies {
  return {
    load: vi.fn().mockResolvedValue({
      status: 'idle',
      durationSeconds: 1800,
      soundEnabled: true,
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
    ...overrides,
  };
}

function dashboard(wagonCount: number, guestCount = wagonCount * 6): AdminDashboard {
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
      registrationOpen: true, compositionLocked: true, nextTicketSequence: guestCount + 1,
    },
    state: { currentModule: 'bunker', screenMode: 'bunker', screenPinned: false, updatedAt: '2026-08-30T12:00:00.000Z' },
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

function questDependencies(): OwnerBunkerQuestDependencies {
  const state = {
    status: 'active' as const,
    phase: 'mission_a' as const,
    phaseStartedAt: '2026-08-30T12:05:00.000Z',
    startedAt: '2026-08-30T12:00:00.000Z',
    durationSeconds: 1800,
    remainingSeconds: 1500,
    soundEnabled: true,
    unlocked: false,
    serverNow: '2026-08-30T12:05:00.000Z',
    teams: [{
      carriageId: 'carriage-1', carriageNumber: 1, label: 'ВАГОН №1',
      missionA: { completed: false, attemptCount: 1, hint: 'Проверить замок' },
      missionB: { completed: false, attemptCount: 0, hint: null, fragment: null },
    }],
  };
  return {
    load: vi.fn().mockResolvedValue(state),
    begin: vi.fn().mockResolvedValue(state),
    advance: vi.fn().mockResolvedValue(state),
    resetStage: vi.fn().mockResolvedValue(state),
    forceStage: vi.fn().mockResolvedValue(state),
    unlock: vi.fn().mockResolvedValue(state),
    broadcast: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AdminBunkerControl', () => {
  afterEach(() => vi.useRealTimers());

  it.each([2, 3, 4, 5])('renders a mobile-readable summary for %i authoritative active wagons', async (wagonCount) => {
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies()}
        dashboard={dashboard(wagonCount)}
      />,
    );

    const summary = await screen.findByRole('list', { name: 'Сводка по вагонам' });
    expect(within(summary).getAllByRole('listitem')).toHaveLength(wagonCount);
    expect(summary).toHaveAttribute('data-count', String(wagonCount));
    expect(within(summary).getByText(`ВАГОН №${wagonCount}`)).toBeInTheDocument();
  });

  it('accepts the recommended wagon distribution through the existing owner command', async () => {
    const user = userEvent.setup();
    const onAcceptDistribution = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies()}
        dashboard={{
          ...dashboard(5, 20),
          event: { ...dashboard(5, 20).event, compositionLocked: false },
        }}
        onAcceptDistribution={onAcceptDistribution}
      />,
    );

    expect(await screen.findByText('РЕКОМЕНДАЦИЯ · 3 ВАГОНА')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ПРИНЯТЬ СХЕМУ · 3 ВАГОНА' }));

    expect(onAcceptDistribution).toHaveBeenCalledWith(3);
  });

  it('warns when the owner manually selects a wagon count different from the recommendation', async () => {
    const user = userEvent.setup();
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies()}
        dashboard={{
          ...dashboard(5, 20),
          event: { ...dashboard(5, 20).event, compositionLocked: false },
        }}
        onAcceptDistribution={vi.fn()}
      />,
    );

    await screen.findByText('РЕКОМЕНДАЦИЯ · 3 ВАГОНА');
    await user.selectOptions(screen.getByLabelText('Количество вагонов'), '5');

    expect(screen.getByRole('status')).toHaveTextContent('ВЫБРАНО ВРУЧНУЮ · 5');
    expect(screen.getByRole('status')).toHaveTextContent('РЕКОМЕНДАЦИЯ · 3');
  });

  it('shows connected-TV telemetry without treating video or audio readiness as Bunker state', async () => {
    let emitPresence: ((presence: { screenId: string; videoReady: boolean; audioArmed: boolean }) => void) | undefined;
    const bunkerDependencies = dependencies({
      load: vi.fn().mockResolvedValue({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1500, soundEnabled: true, globalGameState: 'MISSION_01',
        serverNow: '2026-08-30T12:05:00.000Z',
      }),
      subscribeScreenPresence: (callback) => {
        emitPresence = callback;
        return vi.fn();
      },
    });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={bunkerDependencies}
        dashboard={dashboard(2, 12)}
        questDependencies={questDependencies()}
      />,
    );

    expect(await screen.findByText('ТЕКУЩИЙ ЭТАП · ЛИШНИЙ ПАССАЖИР')).toBeInTheDocument();

    act(() => {
      emitPresence?.({ screenId: 'tv-hall', videoReady: true, audioArmed: false });
    });
    const tv = screen.getByRole('listitem', { name: /tv-hall/i });
    expect(tv).toHaveTextContent('ОНЛАЙН');
    expect(tv).not.toHaveTextContent('ВИДЕО ГОТОВО');
    expect(tv).not.toHaveTextContent('ВИДЕО НЕ ГОТОВО');
    expect(tv).not.toHaveTextContent('ЗВУК ГОТОВ');
    expect(tv).not.toHaveTextContent('ЗВУК НЕ ГОТОВ');
  });

  it('marks an expired TV heartbeat offline without retaining media readiness checks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    let emitPresence: ((presence: { screenId: string; videoReady: boolean; audioArmed: boolean }) => void) | undefined;
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          subscribeScreenPresence: (callback) => {
            emitPresence = callback;
            return vi.fn();
          },
        })}
      />,
    );

    await act(async () => Promise.resolve());
    act(() => emitPresence?.({ screenId: 'tv-hall', videoReady: true, audioArmed: true }));
    expect(screen.getByRole('listitem', { name: /tv-hall/i })).toHaveTextContent('ОНЛАЙН');

    await act(async () => {
      vi.advanceTimersByTime(PREMIERE_SCREEN_PRESENCE_TTL_MS + 1_000);
      await Promise.resolve();
    });

    const expiredTv = screen.getByRole('listitem', { name: /tv-hall/i });
    expect(screen.getByText('ТВ · 0 ОНЛАЙН')).toBeInTheDocument();
    expect(expiredTv).toHaveTextContent('НЕ В СЕТИ');
    expect(expiredTv).toHaveTextContent('16 С НАЗАД');
    expect(expiredTv).toHaveTextContent('НЕИЗВЕСТНО СЕЙЧАС');
    expect(expiredTv).not.toHaveTextContent('ВИДЕО');
    expect(expiredTv).not.toHaveTextContent('ЗВУК');
  });

  it('requires a deliberate second confirmation before starting the 30 minute emergency', async () => {
    const user = userEvent.setup();
    const start = vi.fn().mockResolvedValue({ status: 'active' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1800, soundEnabled: true, serverNow: '2026-08-30T12:00:00.000Z',
      });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({ start, broadcastRefresh, load })}
      />,
    );

    await screen.findByRole('heading', { name: 'БУНКЕР' });
    expect(start).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    expect(screen.getByText('ВСЕ ЭКРАНЫ ПЕРЕКЛЮЧАТСЯ СРАЗУ')).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(start).toHaveBeenCalledWith('event-1', 1800);
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
  });

  it('lets the owner persist saved/excluded story states without removing the guest from play', async () => {
    const user = userEvent.setup();
    const loadCharacters = vi.fn().mockResolvedValue({
      status: 'active',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      characters: [{
        guestId: 'guest-1', realName: 'Гость 1',
        wagon: { id: 'carriage-1', number: 1, label: 'ВАГОН №1' },
        profession: 'МЕХАНИК', characterStatus: 'active', joinedLate: false,
      }],
      serverNow: '2026-08-30T12:05:00.000Z',
    });
    const setCharacterStatus = vi.fn().mockResolvedValue({
      status: 'updated', guestId: 'guest-1', characterStatus: 'saved', changed: true,
    });
    const active = {
      status: 'active' as const, startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
      remainingSeconds: 1500, soundEnabled: true, serverNow: '2026-08-30T12:05:00.000Z',
    };

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue(active),
          loadCharacters,
          setCharacterStatus,
        })}
        dashboard={dashboard(2, 12)}
      />,
    );

    const character = await screen.findByRole('listitem', { name: /гость 1 · механик/i });
    expect(character).toHaveTextContent('ВАГОН №1');
    await user.click(within(character).getByRole('button', { name: 'СПАСЁН' }));

    expect(setCharacterStatus).toHaveBeenCalledWith('event-1', 'guest-1', 'saved');
    expect(await screen.findByRole('listitem', { name: /гость 1 · механик/i })).toHaveTextContent('СПАСЁН');
  });

  it('never exposes legacy direct character-status mutations for a V2 run after M01', async () => {
    const setCharacterStatus = vi.fn();
    render(
      <AdminBunkerControl
        eventId="event-1"
        bunkerContractVersion={2}
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue({
            status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
            remainingSeconds: 1200, soundEnabled: true, globalGameState: 'BREAK',
            serverNow: '2026-08-30T12:10:00.000Z',
          }),
          loadCharacters: vi.fn().mockResolvedValue({
            status: 'active', runNonce: '41000000-0000-4000-8000-000000000001',
            characters: [{
              guestId: 'guest-1', realName: 'Гость 1',
              wagon: { id: 'carriage-1', number: 1, label: 'ВАГОН №1' },
              profession: 'МЕХАНИК', characterStatus: 'saved', joinedLate: false,
            }],
            serverNow: '2026-08-30T12:10:00.000Z',
          }),
          setCharacterStatus,
        })}
        dashboard={dashboard(2, 12)}
      />,
    );

    expect(await screen.findByText('ТЕКУЩИЙ ЭТАП · АРХИВНАЯ ПАУЗА · BK-17')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /статус ·/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'АКТИВЕН' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'СПАСЁН' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ИСКЛЮЧЁН' })).not.toBeInTheDocument();
    expect(setCharacterStatus).not.toHaveBeenCalled();
  });

  it('advances the authoritative global story one understandable owner step at a time', async () => {
    const user = userEvent.setup();
    const advance = vi.fn().mockResolvedValue({
      status: 'transitioned',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      previousState: 'CHARACTERS_READY',
      globalGameState: 'MISSION_01',
      changed: true,
      currentMission: { id: 'mission_01', state: 'MISSION_01', plan: null },
    });
    const active = {
      status: 'active' as const,
      startedAt: '2026-08-30T12:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 1700,
      soundEnabled: true,
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY' as const,
      currentMission: null,
      serverNow: '2026-08-30T12:01:40.000Z',
    };
    const load = vi.fn()
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce({
        ...active,
        globalGameState: 'MISSION_01',
        currentMission: { id: 'mission_01', state: 'MISSION_01', plan: null },
      });
    const deps = {
      ...dependencies({ load }),
      advance,
    } as AdminBunkerControlDependencies;

    render(<AdminBunkerControl eventId="event-1" dependencies={deps} />);

    expect(await screen.findByRole('heading', { name: 'ПРОЛОГ · ПЕРСОНАЖИ ГОТОВЫ' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'НАЧАТЬ ЗАДАНИЕ 1 · ЛИШНИЙ ПАССАЖИР' }));

    expect(advance).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/переключить все телефоны и тв/i);
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ПЕРЕХОД' }));

    expect(advance).toHaveBeenCalledWith('event-1', 'MISSION_01');
    expect(await screen.findByRole('heading', { name: 'ЛИШНИЙ ПАССАЖИР' })).toBeInTheDocument();
  });

  it('uses only V2 prepare and transition commands through MISSION_01 for an authoritative V2 run', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn();
    const distribute = vi.fn();
    const advance = vi.fn();
    const prepareV2 = vi.fn().mockResolvedValue({
      status: 'prepared', eventId: 'event-1',
      runNonce: '41000000-0000-4000-8000-000000000002', contractVersion: 2,
      planVersion: 1, globalGameState: 'LOBBY', wagonCount: 2, guestCount: 15,
      missionInstanceCount: 12,
    });
    const transitionV2 = vi.fn()
      .mockResolvedValueOnce({
        status: 'transitioned', runNonce: '41000000-0000-4000-8000-000000000002',
        contractVersion: 2, previousState: 'LOBBY', globalGameState: 'CHARACTERS_READY',
        changed: true,
      })
      .mockResolvedValueOnce({
        status: 'transitioned', runNonce: '41000000-0000-4000-8000-000000000002',
        contractVersion: 2, previousState: 'CHARACTERS_READY', globalGameState: 'MISSION_01',
        changed: true,
      });
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        globalGameState: 'LOBBY', serverNow: '2026-08-30T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1800, soundEnabled: true,
        runNonce: '41000000-0000-4000-8000-000000000002',
        globalGameState: 'CHARACTERS_READY', serverNow: '2026-08-30T12:00:01.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1799, soundEnabled: true,
        runNonce: '41000000-0000-4000-8000-000000000002',
        globalGameState: 'MISSION_01', serverNow: '2026-08-30T12:00:02.000Z',
      });
    const v2Dependencies = {
      ...dependencies({ load, prepare, distribute, advance }),
      prepareV2,
      transitionV2,
    } as AdminBunkerControlDependencies;

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={v2Dependencies}
        bunkerContractVersion={2}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));
    await user.click(await screen.findByRole('button', { name: 'НАЧАТЬ ЗАДАНИЕ 1 · ЛИШНИЙ ПАССАЖИР' }));
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ПЕРЕХОД' }));

    expect(prepareV2).toHaveBeenCalledWith('event-1');
    expect(transitionV2).toHaveBeenNthCalledWith(1, 'event-1', 'CHARACTERS_READY');
    expect(transitionV2).toHaveBeenNthCalledWith(2, 'event-1', 'MISSION_01');
    expect(prepare).not.toHaveBeenCalled();
    expect(distribute).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
  });

  it('shows authoritative wagon readiness and blocks an early mission transition', async () => {
    const advance = vi.fn();
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          advance,
          load: vi.fn().mockResolvedValue({
            status: 'active',
            startedAt: '2026-08-30T12:00:00.000Z',
            durationSeconds: 1800,
            remainingSeconds: 1500,
            soundEnabled: true,
            globalGameState: 'MISSION_03',
            currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
            missionProgress: {
              missionState: 'MISSION_03',
              completedWagons: 1,
              totalWagons: 2,
              complete: false,
            },
            serverNow: '2026-08-30T12:05:00.000Z',
          }),
        })}
      />,
    );

    expect(await screen.findByText('1 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'НАЧАТЬ ЗАДАНИЕ 4 · МЕЖВАГОННАЯ СВЯЗЬ' })).toBeDisabled();
    expect(advance).not.toHaveBeenCalled();
  });

  it('refreshes authoritative wagon readiness when a guest realtime signal arrives', async () => {
    let emitRefresh: (() => void) | undefined;
    const active = {
      status: 'active' as const,
      startedAt: '2026-08-30T12:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 1500,
      soundEnabled: true,
      globalGameState: 'MISSION_03' as const,
      currentMission: { id: 'mission_03', state: 'MISSION_03' as const, plan: null },
      serverNow: '2026-08-30T12:05:00.000Z',
    };
    const load = vi.fn()
      .mockResolvedValueOnce({
        ...active,
        missionProgress: {
          missionState: 'MISSION_03' as const,
          completedWagons: 0,
          totalWagons: 2,
          complete: false,
        },
      })
      .mockResolvedValueOnce({
        ...active,
        missionProgress: {
          missionState: 'MISSION_03' as const,
          completedWagons: 1,
          totalWagons: 2,
          complete: false,
        },
      });
    const advance = vi.fn();

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          advance,
          load,
          subscribeRefresh: (_eventId, callback) => {
            emitRefresh = callback;
            return vi.fn();
          },
        })}
      />,
    );

    expect(await screen.findByText('0 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();
    act(() => emitRefresh?.());

    expect(await screen.findByText('1 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(advance).not.toHaveBeenCalled();
  });

  it('polls active owner state every two seconds and stops polling once the run is idle', async () => {
    vi.useFakeTimers();
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1500, soundEnabled: true, serverNow: '2026-08-30T12:05:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:05:02.000Z',
      });

    render(<AdminBunkerControl eventId="event-1" dependencies={dependencies({ load })} />);
    await act(async () => { await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1_999);
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the last valid owner state when a background refresh fails', async () => {
    let emitRefresh: (() => void) | undefined;
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1500, soundEnabled: true,
        globalGameState: 'MISSION_03',
        currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
        missionProgress: {
          missionState: 'MISSION_03', completedWagons: 1, totalWagons: 2, complete: false,
        },
        serverNow: '2026-08-30T12:05:00.000Z',
      })
      .mockRejectedValueOnce(new Error('offline'));

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          load,
          subscribeRefresh: (_eventId, callback) => {
            emitRefresh = callback;
            return vi.fn();
          },
        })}
      />,
    );
    expect(await screen.findByText('1 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();

    await act(async () => {
      emitRefresh?.();
      await Promise.resolve();
    });

    expect(screen.getByText('1 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/не удалось обновить статус бункера/i);
  });

  it('deduplicates overlapping realtime owner reloads', async () => {
    let emitRefresh: (() => void) | undefined;
    let resolveRefresh: ((value: Awaited<ReturnType<AdminBunkerControlDependencies['load']>>) => void) | undefined;
    const pendingRefresh = new Promise<Awaited<ReturnType<AdminBunkerControlDependencies['load']>>>((resolve) => {
      resolveRefresh = resolve;
    });
    const active = {
      status: 'active' as const,
      startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
      remainingSeconds: 1500, soundEnabled: true,
      globalGameState: 'MISSION_03' as const,
      currentMission: { id: 'mission_03', state: 'MISSION_03' as const, plan: null },
      missionProgress: {
        missionState: 'MISSION_03' as const, completedWagons: 0, totalWagons: 2, complete: false,
      },
      serverNow: '2026-08-30T12:05:00.000Z',
    };
    const load = vi.fn()
      .mockResolvedValueOnce(active)
      .mockReturnValueOnce(pendingRefresh);

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          load,
          subscribeRefresh: (_eventId, callback) => {
            emitRefresh = callback;
            return vi.fn();
          },
        })}
      />,
    );
    expect(await screen.findByText('0 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();

    act(() => {
      emitRefresh?.();
      emitRefresh?.();
    });
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh?.({
        ...active,
        missionProgress: { ...active.missionProgress, completedWagons: 1 },
      });
      await pendingRefresh;
    });
    expect(screen.getByText('1 / 2 ВАГОНА ГОТОВЫ')).toBeInTheDocument();
  });

  it('uses the explicit event slug for realtime invalidation instead of the event UUID', async () => {
    const subscribeRefresh = vi.fn(() => vi.fn());
    render(
      <AdminBunkerControl
        eventId="00000000-0000-4000-8000-000000000902"
        eventSlug="wedding-rehearsal"
        dependencies={dependencies({ subscribeRefresh })}
      />,
    );

    await act(async () => { await Promise.resolve(); });

    expect(subscribeRefresh).toHaveBeenCalledWith('wedding-rehearsal', expect.any(Function));
    expect(subscribeRefresh).not.toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000902',
      expect.any(Function),
    );
  });

  it('shows the authoritative final countdown even when the whole game started earlier', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T20:00:00.000Z'));
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue({
            status: 'active',
            startedAt: '2026-08-30T18:00:00.000Z',
            durationSeconds: 1800,
            remainingSeconds: 1800,
            soundEnabled: true,
            globalGameState: 'FINAL_30',
            currentMission: null,
            serverNow: '2026-08-30T20:00:00.000Z',
          }),
        })}
      />,
    );

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('30:00')).toBeInTheDocument();
  });

  it('disables the normal Bunker opening until the final code unlocks the server state', async () => {
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          advance: vi.fn(),
          load: vi.fn().mockResolvedValue({
            status: 'active',
            startedAt: '2026-08-30T19:30:00.000Z',
            durationSeconds: 1800,
            remainingSeconds: 1200,
            soundEnabled: true,
            globalGameState: 'FINAL_30',
            currentMission: null,
            unlocked: false,
            serverNow: '2026-08-30T19:40:00.000Z',
          }),
        })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'ОТКРЫТЬ БУНКЕР' })).toBeDisabled();
    expect(screen.getByText(/штатное открытие станет доступно после правильного финального кода/i)).toBeInTheDocument();
  });

  it('enables normal opening and hides recovery after the final code unlocks the server state', async () => {
    const taskDependencies = Object.assign(dependencies({
      advance: vi.fn(),
      load: vi.fn().mockResolvedValue({
        status: 'active',
        startedAt: '2026-08-30T19:30:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 1200,
        soundEnabled: true,
        globalGameState: 'FINAL_30',
        currentMission: null,
        unlocked: true,
        serverNow: '2026-08-30T19:40:00.000Z',
      }),
    }), { forceOpen: vi.fn() });

    render(<AdminBunkerControl eventId="event-1" dependencies={taskDependencies} />);

    expect(await screen.findByRole('button', { name: 'ОТКРЫТЬ БУНКЕР' })).toBeEnabled();
    expect(screen.queryByRole('region', { name: 'Аварийное открытие Бункера' })).not.toBeInTheDocument();
  });

  it('requires a recovery reason and exact phrase before the owner can force the Bunker open', async () => {
    const user = userEvent.setup();
    const forceOpen = vi.fn().mockResolvedValue({
      status: 'transitioned', globalGameState: 'BUNKER_OPEN', changed: true, forced: true,
    });
    const taskDependencies = Object.assign(dependencies({
      advance: vi.fn(),
      load: vi.fn().mockResolvedValue({
        status: 'active',
        startedAt: '2026-08-30T19:30:00.000Z',
        durationSeconds: 1800,
        remainingSeconds: 1200,
        soundEnabled: true,
        globalGameState: 'FINAL_30',
        currentMission: null,
        unlocked: false,
        serverNow: '2026-08-30T19:40:00.000Z',
      }),
    }), { forceOpen });

    render(<AdminBunkerControl eventId="event-1" dependencies={taskDependencies} />);

    const recovery = await screen.findByRole('region', { name: 'Аварийное открытие Бункера' });
    const submit = within(recovery).getByRole('button', { name: 'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО' });
    expect(submit).toBeDisabled();

    await user.type(within(recovery).getByRole('textbox', { name: 'Причина аварийного открытия' }), 'Сбой');
    await user.type(
      within(recovery).getByRole('textbox', { name: 'Контрольная фраза' }),
      'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО',
    );
    expect(submit).toBeDisabled();

    await user.clear(within(recovery).getByRole('textbox', { name: 'Причина аварийного открытия' }));
    await user.type(
      within(recovery).getByRole('textbox', { name: 'Причина аварийного открытия' }),
      'Финальный телефон не отвечает',
    );
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(forceOpen).toHaveBeenCalledWith(
      'event-1',
      'Финальный телефон не отвечает',
      'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО',
    );
  });

  it('lets the owner recover one confirmed wagon through a separate force confirmation', async () => {
    const user = userEvent.setup();
    const forceCompleteMission = vi.fn().mockResolvedValue({
      status: 'completed', missionState: 'MISSION_03', carriageId: 'carriage-1',
      completedAt: '2026-08-30T12:06:00.000Z', changed: true, submittedPayload: { forced: true },
    });
    const active = {
      status: 'active' as const,
      startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
      remainingSeconds: 1500, soundEnabled: true,
      globalGameState: 'MISSION_03' as const,
      currentMission: { id: 'mission_03', state: 'MISSION_03' as const, plan: null },
      missionProgress: { missionState: 'MISSION_03' as const, completedWagons: 1, totalWagons: 2, complete: false },
      serverNow: '2026-08-30T12:05:00.000Z',
    };
    render(
      <AdminBunkerControl
        eventId="event-1"
        dashboard={dashboard(2)}
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue(active),
          advance: vi.fn(),
          forceCompleteMission,
        })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПОМЕТИТЬ ГОТОВЫМ · ВАГОН №1' }));
    expect(forceCompleteMission).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ГОТОВНОСТЬ ВАГОНА' }));
    expect(forceCompleteMission).toHaveBeenCalledWith('event-1', 'carriage-1', 'MISSION_03');
  });

  it('shows the host script for the authoritative current mission', async () => {
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue({
            status: 'active',
            startedAt: '2026-08-30T12:00:00.000Z',
            durationSeconds: 1800,
            remainingSeconds: 1500,
            soundEnabled: true,
            runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
            globalGameState: 'MISSION_03',
            currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
            serverNow: '2026-08-30T12:05:00.000Z',
          }),
        })}
      />,
    );

    const runbook = await screen.findByRole('region', { name: 'Сценарий ведущего Бункера' });
    expect(within(runbook).getByRole('heading', { name: 'Аварийный запас' })).toBeInTheDocument();
    expect(within(runbook).getByRole('heading', { name: 'СЕЙЧАС ПРОЧИТАТЬ' })).toBeInTheDocument();
    expect(within(runbook).getByText(/закрыть все проблемы нельзя/i)).toBeInTheDocument();
  });

  it('prioritizes authoritative runtime and does not render the independent legacy quest panel', async () => {
    const legacy = questDependencies();
    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({
          load: vi.fn().mockResolvedValue({
            status: 'active',
            startedAt: '2026-08-30T12:00:00.000Z',
            durationSeconds: 1800,
            remainingSeconds: 1500,
            soundEnabled: true,
            runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
            globalGameState: 'MISSION_03',
            currentMission: { id: 'mission_03', state: 'MISSION_03', plan: null },
            serverNow: '2026-08-30T12:05:00.000Z',
          }),
        })}
        questDependencies={legacy}
      />,
    );

    expect(await screen.findByText('ТЕКУЩИЙ ЭТАП · АВАРИЙНЫЙ ЗАПАС')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ОТКРЫТЬ ЗАДАНИЕ B' })).not.toBeInTheDocument();
    expect(legacy.load).not.toHaveBeenCalled();
  });

  it('prepares the run and distributes characters before the first emergency start', async () => {
    const user = userEvent.setup();
    const commands: string[] = [];
    const prepare = vi.fn().mockImplementation(async () => {
      commands.push('prepare');
      return {
        status: 'prepared', eventId: 'event-1',
        runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
        globalGameState: 'LOBBY', gameMode: 'production', wagonCount: 4, guestCount: 32,
      };
    });
    const distribute = vi.fn().mockImplementation(async () => {
      commands.push('distribute');
      return {
        status: 'characters_ready',
        runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
        globalGameState: 'CHARACTERS_READY', assignedCount: 32, wagonCount: 4,
      };
    });
    const start = vi.fn().mockImplementation(async () => {
      commands.push('start');
      return { status: 'active' };
    });
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1800, soundEnabled: true, serverNow: '2026-08-30T12:00:00.000Z',
      });
    const bunkerDependencies = {
      ...dependencies({ start, load }),
      prepare,
      distribute,
    };

    render(<AdminBunkerControl eventId="event-1" dependencies={bunkerDependencies} />);

    await user.click(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    expect(commands).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
    expect(commands).toEqual(['prepare', 'distribute', 'start']);
    expect(prepare).toHaveBeenCalledWith('event-1', 'production');
    expect(distribute).toHaveBeenCalledWith('event-1');
  });

  it('keeps an already prepared character run intact during the first emergency start', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn().mockResolvedValue({
      status: 'prepared', eventId: 'event-1',
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY', gameMode: 'production', wagonCount: 4, guestCount: 32,
    });
    const distribute = vi.fn().mockResolvedValue({ status: 'characters_ready' });
    const start = vi.fn().mockResolvedValue({ status: 'active' });
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1800, soundEnabled: true, serverNow: '2026-08-30T12:00:00.000Z',
      });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={{ ...dependencies({ start, load }), prepare, distribute }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
    expect(distribute).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['preparation', 'prepare'],
    ['character distribution', 'distribute'],
    ['projector start', 'start'],
  ] as const)('does not activate or broadcast when %s fails', async (_label, failingCommand) => {
    const user = userEvent.setup();
    const prepare = failingCommand === 'prepare'
      ? vi.fn().mockRejectedValue(new Error('prepare failed'))
      : vi.fn().mockResolvedValue({
          status: 'prepared', eventId: 'event-1',
          runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
          globalGameState: 'LOBBY', gameMode: 'production', wagonCount: 4, guestCount: 32,
        });
    const distribute = failingCommand === 'distribute'
      ? vi.fn().mockRejectedValue(new Error('distribution failed'))
      : vi.fn().mockResolvedValue({ status: 'characters_ready' });
    const start = failingCommand === 'start'
      ? vi.fn().mockRejectedValue(new Error('start failed'))
      : vi.fn().mockResolvedValue({ status: 'active' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={{
          ...dependencies({ start, broadcastRefresh }),
          prepare,
          distribute,
        }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    const alert = await screen.findByText(/Не выполнено ·/i);
    expect(alert).toHaveTextContent(
      failingCommand === 'prepare'
        ? /этап подготовки/i
        : failingCommand === 'distribute'
          ? /этап распределения персонажей/i
          : /этап запуска на тв/i,
    );
    expect(alert).toHaveTextContent(
      failingCommand === 'prepare'
        ? /prepare failed/i
        : failingCommand === 'distribute'
          ? /distribution failed/i
          : /start failed/i,
    );
    expect(start).toHaveBeenCalledTimes(failingCommand === 'start' ? 1 : 0);
    expect(broadcastRefresh).not.toHaveBeenCalled();
    if (failingCommand === 'prepare') expect(distribute).not.toHaveBeenCalled();
  });

  it('restarts only the timer for the active run without preparing or redistributing characters', async () => {
    const user = userEvent.setup();
    const prepare = vi.fn();
    const distribute = vi.fn();
    const start = vi.fn().mockResolvedValue({ status: 'active' });
    const active = {
      status: 'active' as const, startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
      remainingSeconds: 1700, soundEnabled: true, serverNow: '2026-08-30T12:01:40.000Z',
    };

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={{
          ...dependencies({ load: vi.fn().mockResolvedValue(active), start }),
          prepare,
          distribute,
        }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПЕРЕЗАПУСТИТЬ 30:00' }));
    expect(start).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ПЕРЕЗАПУСК' }));

    expect(start).toHaveBeenCalledWith('event-1', 1800);
    expect(prepare).not.toHaveBeenCalled();
    expect(distribute).not.toHaveBeenCalled();
  });

  it('requires confirmation before stopping an active bunker and broadcasts only after confirmation', async () => {
    const user = userEvent.setup();
    const stop = vi.fn().mockResolvedValue({ status: 'idle' });
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1700, soundEnabled: true, serverNow: '2026-08-30T12:01:40.000Z',
      })
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:01:41.000Z',
      });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({ stop, broadcastRefresh, load })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' }));

    expect(stop).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('ОСТАНОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ?');
    await user.click(screen.getByRole('button', { name: 'ПОДТВЕРДИТЬ ОСТАНОВКУ' }));

    expect(stop).toHaveBeenCalledWith('event-1');
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' })).toBeInTheDocument();
  });

  it('keeps the authoritative bunker state when realtime broadcast fails after a successful command', async () => {
    const user = userEvent.setup();
    const start = vi.fn().mockResolvedValue({ status: 'active' });
    const broadcastRefresh = vi.fn().mockRejectedValue(new Error('realtime offline'));
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle', durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'active', startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
        remainingSeconds: 1800, soundEnabled: true, serverNow: '2026-08-30T12:00:00.000Z',
      });

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({ start, broadcastRefresh, load })}
      />,
    );

    await screen.findByRole('heading', { name: 'БУНКЕР' });
    await user.click(screen.getByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(start).toHaveBeenCalledTimes(1);
    expect(broadcastRefresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/команда выполнена/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/не выполнена/i);
  });

  it('reconciles an ambiguous projector-start response before the owner can retry', async () => {
    const user = userEvent.setup();
    const active = {
      status: 'active' as const, startedAt: '2026-08-30T12:00:00.000Z', durationSeconds: 1800,
      remainingSeconds: 1800, soundEnabled: true, globalGameState: 'CHARACTERS_READY' as const,
      serverNow: '2026-08-30T12:00:00.000Z',
    };
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle' as const, durationSeconds: 1800, soundEnabled: true,
        serverNow: '2026-08-30T11:59:59.000Z',
      })
      .mockResolvedValueOnce(active);
    const start = vi.fn().mockRejectedValue(new Error('connection closed after commit'));
    const readProjectorStarted = vi.fn().mockResolvedValue(true);

    render(
      <AdminBunkerControl
        eventId="event-1"
        dependencies={dependencies({ load, start, readProjectorStarted })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(await screen.findByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
    expect(readProjectorStarted).toHaveBeenCalledWith('event-1');
    expect(await screen.findByText(/статус перечитан.*бункер активен/i)).toBeInTheDocument();
    expect(screen.queryByText(/не выполнено/i)).not.toBeInTheDocument();
  });

  it('does not treat a prepared V2 bunker row as a successful projector start', async () => {
    const user = userEvent.setup();
    const prepared = {
      status: 'active' as const,
      startedAt: '2026-08-30T12:00:00.000Z',
      durationSeconds: 1800,
      remainingSeconds: 1800,
      soundEnabled: true,
      runNonce: '4d66c744-3e97-4b63-846b-51a8213b047f',
      globalGameState: 'CHARACTERS_READY' as const,
      serverNow: '2026-08-30T12:00:00.000Z',
    };
    const start = vi.fn()
      .mockRejectedValueOnce(new Error('connection closed before commit'))
      .mockResolvedValueOnce({ status: 'active' });
    const readProjectorStarted = vi.fn().mockResolvedValue(false);
    const broadcastRefresh = vi.fn().mockResolvedValue(undefined);
    const prepareV2 = vi.fn().mockResolvedValue({
      status: 'prepared',
      eventId: 'event-1',
      runNonce: prepared.runNonce,
      contractVersion: 2,
      planVersion: 1,
      globalGameState: 'LOBBY',
      wagonCount: 2,
      guestCount: 15,
      missionInstanceCount: 12,
    });
    const transitionV2 = vi.fn().mockResolvedValue({
      status: 'transitioned',
      runNonce: prepared.runNonce,
      contractVersion: 2,
      previousState: 'LOBBY',
      globalGameState: 'CHARACTERS_READY',
      changed: true,
    });
    const load = vi.fn()
      .mockResolvedValueOnce({
        status: 'idle' as const,
        durationSeconds: 1800,
        soundEnabled: true,
        serverNow: '2026-08-30T11:59:59.000Z',
      })
      .mockResolvedValueOnce(prepared);

    render(
      <AdminBunkerControl
        eventId="event-1"
        bunkerContractVersion={2}
        dependencies={dependencies({
          load,
          prepareV2,
          transitionV2,
          start,
          readProjectorStarted,
          broadcastRefresh,
        })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ' }));
    await user.click(screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' }));

    expect(readProjectorStarted).toHaveBeenCalledWith('event-1');
    expect(await screen.findByText(/Не выполнено ·/i)).toHaveTextContent(/этап запуска на тв/i);
    const retry = screen.getByRole('button', { name: 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00' });
    expect(retry).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).not.toBeInTheDocument();
    expect(broadcastRefresh).not.toHaveBeenCalled();

    await user.click(retry);

    expect(start).toHaveBeenCalledTimes(2);
    expect(prepareV2).toHaveBeenCalledTimes(1);
    expect(transitionV2).toHaveBeenCalledTimes(1);
    expect(readProjectorStarted).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'ОСТАНОВИТЬ БУНКЕР' })).toBeInTheDocument();
  });
});
