import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import type { AdminDashboard } from '../admin.service';
import {
  balancedCarriageSizes,
  recommendCarriageCount,
  type SupportedCarriageCount,
} from '../../carriages/carriageAllocator';
import {
  broadcastBunkerRefresh,
  subscribeToBunkerRefresh,
  type BunkerRealtimeClient,
} from '../../bunker/bunker.realtime';
import {
  forceOpenBunker,
  getOwnerBunkerControl,
  setBunkerSound,
  startBunker,
  stopBunker,
  type BunkerRpcClient,
  type OwnerBunkerControl,
} from '../../bunker/bunker.service';
import {
  advanceBunkerGameState,
  distributeBunkerCharacters,
  prepareBunkerGame,
  type AdvancedBunkerGameState,
  type BunkerGlobalGameState,
  type DistributedBunkerCharacters,
  type PreparedBunkerGame,
} from '../../bunker/bunkerSession.service';
import {
  getOwnerBunkerCharacters,
  setOwnerBunkerCharacterStatus,
  type BunkerCharacterStatus,
  type OwnerBunkerCharacter,
  type OwnerBunkerCharacters,
  type UpdatedBunkerCharacterStatus,
} from '../../bunker/bunkerCharacters.service';
import {
  getPremierePresenceSummary,
  PREMIERE_SCREEN_PRESENCE_TTL_MS,
  recordPremiereScreenPresence,
  type PremiereScreenPresenceRecord,
} from '../../premiere/premierePresence';
import {
  subscribeToPremiereScreenPresence,
  type PremierePresenceRealtimeClient,
  type PremiereScreenPresence,
} from '../../premiere/premierePresence.realtime';
import {
  useOwnerBunkerQuestState,
  type OwnerBunkerQuestDependencies,
} from '../../bunker/useOwnerBunkerQuestState';
import { BunkerQuestOwnerPanel, bunkerPhaseTitle } from './BunkerQuestOwnerPanel';
import { BunkerHostRunbook } from './BunkerHostRunbook';
import {
  forceCompleteBunkerGlobalMission,
  isBunkerGlobalMissionState,
  type BunkerGlobalMissionState,
  type GuestBunkerGlobalMissionSubmission,
} from '../../bunker/bunkerGlobalMission.service';

export type AdminBunkerControlDependencies = {
  load: (eventId: string) => Promise<OwnerBunkerControl>;
  prepare: (eventId: string, gameMode: 'production') => Promise<PreparedBunkerGame>;
  distribute: (eventId: string) => Promise<DistributedBunkerCharacters>;
  advance?: (
    eventId: string,
    nextState: BunkerGlobalGameState,
  ) => Promise<AdvancedBunkerGameState>;
  forceCompleteMission?: (
    eventId: string,
    carriageId: string,
    missionState: BunkerGlobalMissionState,
  ) => Promise<GuestBunkerGlobalMissionSubmission>;
  forceOpen?: (
    eventId: string,
    reason: string,
    confirmation: string,
  ) => Promise<unknown>;
  loadCharacters?: (eventId: string) => Promise<OwnerBunkerCharacters>;
  setCharacterStatus?: (
    eventId: string,
    guestId: string,
    status: BunkerCharacterStatus,
  ) => Promise<UpdatedBunkerCharacterStatus>;
  start: (eventId: string, durationSeconds: number) => Promise<unknown>;
  stop: (eventId: string) => Promise<unknown>;
  setSound: (eventId: string, enabled: boolean) => Promise<unknown>;
  broadcastRefresh: (eventSlug: string) => Promise<void>;
  subscribeRefresh?: (eventSlug: string, callback: () => void) => () => void;
  subscribeScreenPresence?: (callback: (presence: PremiereScreenPresence) => void) => () => void;
};

type AdminBunkerControlProps = {
  eventId: string;
  eventSlug: string;
  dependencies?: AdminBunkerControlDependencies;
  dashboard?: AdminDashboard;
  onAcceptDistribution?: (carriageCount: SupportedCarriageCount) => Promise<void> | void;
  questDependencies?: OwnerBunkerQuestDependencies;
};

const SUPPORTED_WAGON_COUNTS: SupportedCarriageCount[] = [2, 3, 4, 5];

function browserDependencies(eventSlug: string): AdminBunkerControlDependencies | null {
  try {
    const client = getSupabaseClient();
    const rpcClient = client as unknown as BunkerRpcClient;
    const realtimeClient = client as unknown as BunkerRealtimeClient;
    const presenceClient = client as unknown as PremierePresenceRealtimeClient;
    return {
      load: (eventId) => getOwnerBunkerControl(rpcClient, eventId),
      prepare: (eventId, gameMode) => prepareBunkerGame(rpcClient, eventId, gameMode),
      distribute: (eventId) => distributeBunkerCharacters(rpcClient, eventId),
      advance: (eventId, nextState) => advanceBunkerGameState(rpcClient, eventId, nextState),
      forceCompleteMission: (eventId, carriageId, missionState) => forceCompleteBunkerGlobalMission(
        rpcClient,
        eventId,
        carriageId,
        missionState,
      ),
      forceOpen: (eventId, reason, confirmation) => forceOpenBunker(
        rpcClient,
        eventId,
        reason,
        confirmation,
      ),
      loadCharacters: (eventId) => getOwnerBunkerCharacters(rpcClient, eventId),
      setCharacterStatus: (eventId, guestId, status) => (
        setOwnerBunkerCharacterStatus(rpcClient, eventId, guestId, status)
      ),
      start: (eventId, durationSeconds) => startBunker(rpcClient, eventId, durationSeconds),
      stop: (eventId) => stopBunker(rpcClient, eventId),
      setSound: (eventId, enabled) => setBunkerSound(rpcClient, eventId, enabled),
      broadcastRefresh: (eventSlug) => broadcastBunkerRefresh(realtimeClient, eventSlug),
      subscribeRefresh: (eventSlug, callback) => subscribeToBunkerRefresh(
        realtimeClient,
        eventSlug,
        callback,
      ),
      subscribeScreenPresence: (callback) => subscribeToPremiereScreenPresence(
        presenceClient,
        eventSlug,
        callback,
      ),
    };
  } catch {
    return null;
  }
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

const GLOBAL_STATE_LABELS: Record<BunkerGlobalGameState, string> = {
  LOBBY: 'ПРОЛОГ · ПОДГОТОВКА',
  CHARACTERS_READY: 'ПРОЛОГ · ПЕРСОНАЖИ ГОТОВЫ',
  MISSION_01: 'ЛИШНИЙ ПАССАЖИР',
  BREAK: 'АРХИВНАЯ ПАУЗА · BK-17',
  MISSION_02: 'ЧЁРНЫЙ ЯЩИК',
  MISSION_03: 'АВАРИЙНЫЙ ЗАПАС',
  MISSION_04: 'МЕЖВАГОННАЯ СВЯЗЬ',
  MISSION_05: 'ОДИН ШАНС',
  MISSION_06: 'ОБЩИЙ ПРОТОКОЛ',
  STORY_BUNKER: 'РАСКРЫТИЕ · ИСТОРИЯ БУНКЕРА',
  BREAK_BEFORE_FINAL: 'ПЕРЕД ФИНАЛОМ · ПРОВЕРКА ГОТОВНОСТИ',
  FINAL_30: 'БУНКЕР · ОБЩИЙ ТАЙМЕР 30:00',
  BUNKER_OPEN: 'БУНКЕР ОТКРЫТ',
  FINISHED: 'ИГРА ЗАВЕРШЕНА',
};

const GLOBAL_STATE_NEXT: Partial<Record<BunkerGlobalGameState, {
  state: BunkerGlobalGameState;
  label: string;
}>> = {
  CHARACTERS_READY: { state: 'MISSION_01', label: 'НАЧАТЬ МИССИЮ 01' },
  MISSION_01: { state: 'BREAK', label: 'ПЕРЕЙТИ К ПЕРЕРЫВУ' },
  BREAK: { state: 'MISSION_02', label: 'НАЧАТЬ МИССИЮ 02' },
  MISSION_02: { state: 'MISSION_03', label: 'НАЧАТЬ МИССИЮ 03' },
  MISSION_03: { state: 'MISSION_04', label: 'НАЧАТЬ МИССИЮ 04' },
  MISSION_04: { state: 'MISSION_05', label: 'НАЧАТЬ МИССИЮ 05' },
  MISSION_05: { state: 'MISSION_06', label: 'НАЧАТЬ МИССИЮ 06' },
  MISSION_06: { state: 'STORY_BUNKER', label: 'ОТКРЫТЬ ИСТОРИЮ БУНКЕРА' },
  STORY_BUNKER: { state: 'BREAK_BEFORE_FINAL', label: 'ПЕРЕРЫВ ПЕРЕД ФИНАЛОМ' },
  BREAK_BEFORE_FINAL: { state: 'FINAL_30', label: 'НАЧАТЬ ФИНАЛ · 30:00' },
  FINAL_30: { state: 'BUNKER_OPEN', label: 'ОТКРЫТЬ БУНКЕР' },
  BUNKER_OPEN: { state: 'FINISHED', label: 'ЗАВЕРШИТЬ ИГРУ' },
};

const FORCE_OPEN_CONFIRMATION = 'ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО';

export function AdminBunkerControl({
  eventId,
  eventSlug,
  dependencies,
  dashboard,
  onAcceptDistribution,
  questDependencies,
}: AdminBunkerControlProps) {
  const deps = useMemo(
    () => dependencies ?? browserDependencies(eventSlug),
    [dependencies, eventSlug],
  );
  const [state, setState] = useState<OwnerBunkerControl | null>(null);
  const [armed, setArmed] = useState(false);
  const [dangerCommand, setDangerCommand] = useState<'restart' | 'stop' | null>(null);
  const [pendingGlobalState, setPendingGlobalState] = useState<BunkerGlobalGameState | null>(null);
  const [pendingForceWagon, setPendingForceWagon] = useState<{ id: string; label: string } | null>(null);
  const [forceOpenReason, setForceOpenReason] = useState('');
  const [forceOpenConfirmation, setForceOpenConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [distributionBusy, setDistributionBusy] = useState(false);
  const recommendedWagonCount = recommendCarriageCount(dashboard?.guests.length ?? 0);
  const [selectedWagonCount, setSelectedWagonCount] = useState<SupportedCarriageCount>(recommendedWagonCount);
  const [manuallySelected, setManuallySelected] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [characters, setCharacters] = useState<OwnerBunkerCharacter[]>([]);
  const [characterBusy, setCharacterBusy] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());
  const [screenPresence, setScreenPresence] = useState<PremiereScreenPresenceRecord[]>([]);
  const serverOffsetRef = useRef(0);
  const reloadGenerationRef = useRef(0);
  const reloadInFlightRef = useRef<{
    generation: number;
    promise: Promise<OwnerBunkerControl | null>;
  } | null>(null);
  const quest = useOwnerBunkerQuestState(eventId, {
    dependencies: questDependencies,
    enabled: state?.status === 'active'
      && state.globalGameState === undefined
      && (!dependencies || Boolean(questDependencies)),
  });

  useEffect(() => {
    if (!dashboard?.event.compositionLocked && !manuallySelected) {
      setSelectedWagonCount(recommendedWagonCount);
    }
  }, [dashboard?.event.compositionLocked, manuallySelected, recommendedWagonCount]);

  useEffect(() => {
    if (!deps?.subscribeScreenPresence) return undefined;
    return deps.subscribeScreenPresence((presence) => {
      const receivedAt = Date.now();
      setPresenceNowMs(receivedAt);
      setScreenPresence((current) => recordPremiereScreenPresence(current, presence, receivedAt));
    });
  }, [deps]);

  useEffect(() => {
    if (!deps?.subscribeScreenPresence) return undefined;
    const interval = window.setInterval(() => setPresenceNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [deps]);

  const storeState = useCallback((next: OwnerBunkerControl) => {
    const receivedAt = Date.now();
    const serverMs = Date.parse(next.serverNow);
    serverOffsetRef.current = Number.isFinite(serverMs) ? serverMs - receivedAt : 0;
    setNowMs(receivedAt);
    setState(next);
    setRefreshError('');
  }, []);

  const reload = useCallback((generation = reloadGenerationRef.current) => {
    if (!deps) return Promise.resolve(null);
    const current = reloadInFlightRef.current;
    if (current?.generation === generation) return current.promise;

    let request: Promise<OwnerBunkerControl | null>;
    request = deps.load(eventId)
      .then((next) => {
        if (reloadGenerationRef.current === generation) storeState(next);
        return next;
      })
      .catch((loadError: unknown) => {
        if (reloadGenerationRef.current === generation) {
          setRefreshError('Не удалось обновить статус Бункера. Показываем последние полученные данные.');
        }
        throw loadError;
      })
      .finally(() => {
        if (reloadInFlightRef.current?.promise === request) reloadInFlightRef.current = null;
      });
    reloadInFlightRef.current = { generation, promise: request };
    return request;
  }, [deps, eventId, storeState]);

  useEffect(() => {
    if (!deps) return;
    const generation = ++reloadGenerationRef.current;
    void reload(generation).catch(() => undefined);
    return () => {
      reloadGenerationRef.current += 1;
      reloadInFlightRef.current = null;
    };
  }, [deps, reload]);

  useEffect(() => {
    if (!deps?.subscribeRefresh) return undefined;
    return deps.subscribeRefresh(eventSlug, () => {
      void reload().catch(() => undefined);
    });
  }, [deps, eventSlug, reload]);

  useEffect(() => {
    if (state?.status !== 'active') return undefined;
    const interval = window.setInterval(() => {
      void reload().catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [reload, state?.status]);

  useEffect(() => {
    if (state?.status !== 'active') return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [state?.status]);

  useEffect(() => {
    const loadCharacters = deps?.loadCharacters;
    if (state?.status !== 'active' || !loadCharacters) {
      setCharacters([]);
      return undefined;
    }
    let active = true;
    void loadCharacters(eventId)
      .then((next) => {
        if (active) setCharacters(next.status === 'active' ? next.characters : []);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить сюжетные статусы персонажей.');
      });
    return () => {
      active = false;
    };
  }, [deps, eventId, state?.status]);

  if (!deps) return null;

  const remaining = state?.status === 'active'
    ? Math.max(
        0,
        Math.ceil(
          state.remainingSeconds
          - Math.max(
            0,
            (nowMs + serverOffsetRef.current - Date.parse(state.serverNow)) / 1000,
          ),
        ),
      )
    : 0;

  const run = async (command: () => Promise<unknown>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError('');

    try {
      try {
        await command();
      } catch {
        setError('Команда Бункера не выполнена. Проверьте связь и owner-доступ.');
        return false;
      }

      let warning = '';
      try {
        await deps.broadcastRefresh(eventSlug);
      } catch {
        warning = 'Команда выполнена. Realtime-сигнал не отправлен — ТВ подхватят состояние автоматически.';
      }

      try {
        await reload();
      } catch {
        warning = warning || 'Команда выполнена, но не удалось перечитать статус. Не нажимайте повторно — проверьте связь.';
      }

      setError(warning);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    await run(async () => {
      const prepared = await deps.prepare(eventId, 'production');
      if (prepared.globalGameState === 'LOBBY') {
        await deps.distribute(eventId);
      }
      await deps.start(eventId, 1800);
    });
    setArmed(false);
  };

  const acceptDistribution = async () => {
    if (!onAcceptDistribution || distributionBusy) return;
    setDistributionBusy(true);
    setError('');
    try {
      await onAcceptDistribution(selectedWagonCount);
    } catch {
      setError('Не удалось применить распределение. Проверьте связь и owner-доступ.');
    } finally {
      setDistributionBusy(false);
    }
  };

  const activeWagons = dashboard?.carriages
    .filter((carriage) => carriage.enabled)
    .map((carriage) => ({
      id: carriage.id,
      label: carriage.label,
      count: dashboard.guests.filter((guest) => guest.carriage.id === carriage.id).length,
    })) ?? [];
  const previewSizes = dashboard && !dashboard.event.compositionLocked
    ? balancedCarriageSizes(dashboard.guests.length, selectedWagonCount)
    : [];
  const wagonSummary = dashboard?.event.compositionLocked
    ? activeWagons
    : previewSizes.map((count, index) => ({ id: `preview-${index + 1}`, label: `ВАГОН №${index + 1}`, count }));
  const presenceSummary = getPremierePresenceSummary(screenPresence, presenceNowMs);
  const globalState = state?.globalGameState;
  const currentStage = globalState
    ? GLOBAL_STATE_LABELS[globalState]
    : quest.state?.status === 'active'
      ? bunkerPhaseTitle(quest.state.phase)
      : state?.status === 'active'
        ? 'ПОЛУЧАЕМ СТАТУС'
        : 'ОЖИДАНИЕ ЗАПУСКА';
  const nextGlobalState = globalState ? GLOBAL_STATE_NEXT[globalState] : undefined;
  const advanceGlobalState = deps.advance;
  const missionProgress = state?.status === 'active' ? state.missionProgress : null;
  const missionTransitionBlocked = missionProgress?.complete === false;
  const finalOpeningLocked = globalState === 'FINAL_30' && state?.unlocked !== true;

  const confirmDangerCommand = async () => {
    if (dangerCommand === 'restart') {
      await run(() => deps.start(eventId, 1800));
    } else if (dangerCommand === 'stop') {
      await run(() => deps.stop(eventId));
    }
    setDangerCommand(null);
  };

  const confirmGlobalTransition = async () => {
    if (!pendingGlobalState || !advanceGlobalState) return;
    await run(() => advanceGlobalState(eventId, pendingGlobalState));
    setPendingGlobalState(null);
  };

  const confirmForceWagon = async () => {
    if (!pendingForceWagon
      || !deps.forceCompleteMission
      || !isBunkerGlobalMissionState(globalState)) return;
    await run(() => deps.forceCompleteMission!(eventId, pendingForceWagon.id, globalState));
    setPendingForceWagon(null);
  };

  const forceOpenReady = forceOpenReason.trim().length >= 12
    && forceOpenConfirmation === FORCE_OPEN_CONFIRMATION;

  const confirmForceOpen = async () => {
    if (!deps.forceOpen || !forceOpenReady) return;
    const succeeded = await run(() => deps.forceOpen!(
      eventId,
      forceOpenReason.trim(),
      forceOpenConfirmation,
    ));
    if (succeeded) {
      setForceOpenReason('');
      setForceOpenConfirmation('');
    }
  };

  const updateCharacterStatus = async (
    character: OwnerBunkerCharacter,
    nextStatus: BunkerCharacterStatus,
  ) => {
    if (!deps.setCharacterStatus || characterBusy) return;
    setCharacterBusy(character.guestId);
    setError('');
    try {
      const result = await deps.setCharacterStatus(eventId, character.guestId, nextStatus);
      setCharacters((current) => current.map((entry) => (
        entry.guestId === result.guestId
          ? { ...entry, characterStatus: result.characterStatus }
          : entry
      )));
      try {
        await deps.broadcastRefresh(eventSlug);
      } catch {
        setError('Статус сохранён. Realtime-сигнал не отправлен — клиенты обновятся автоматически.');
      }
    } catch {
      setError('Не удалось сохранить сюжетный статус персонажа.');
    } finally {
      setCharacterBusy(null);
    }
  };

  return (
    <section className={`admin-bunker-control${state?.status === 'active' ? ' admin-bunker-control--active' : ''}`}>
      <div className="admin-bunker-control__heading">
        <div>
          <p className="eyebrow">ДИСПЕТЧЕРСКАЯ · OWNER ONLY</p>
          <h2 aria-label="БУНКЕР">БУНКЕР · ПУЛЬТ</h2>
        </div>
        <strong>{state?.status === 'active' ? formatTimer(remaining) : 'ГОТОВ К ЗАПУСКУ'}</strong>
      </div>

      <div className="admin-bunker-dispatcher-summary" aria-label="Сводка диспетчера">
        <article>
          <span>ГОСТИ</span>
          <strong>{dashboard ? dashboard.guests.length : '—'}</strong>
          <small>{dashboard ? 'ПО ДАННЫМ АДМИНКИ' : 'ДАННЫЕ НЕ ПОДКЛЮЧЕНЫ'}</small>
        </article>
        <article>
          <span>ВАГОНЫ</span>
          <strong>{dashboard ? wagonSummary.length : '—'}</strong>
          <small>{dashboard?.event.compositionLocked ? 'СОСТАВ ЗАФИКСИРОВАН' : dashboard ? 'СХЕМА НЕ ПРИНЯТА' : 'ДАННЫЕ НЕ ПОДКЛЮЧЕНЫ'}</small>
        </article>
        <article>
          <span>ТВ НА СВЯЗИ</span>
          <strong>{deps.subscribeScreenPresence ? presenceSummary.connectedCount : '—'}</strong>
          <small>{deps.subscribeScreenPresence ? (presenceSummary.connectedCount > 0 ? 'ОНЛАЙН' : 'НЕТ СИГНАЛА') : 'ТЕЛЕМЕТРИЯ НЕДОСТУПНА'}</small>
        </article>
        <article>
          <span>ТЕКУЩИЙ ЭТАП</span>
          <strong>{currentStage}</strong>
          <small>{globalState ? 'АВТОРИТЕТНЫЙ СЕРВЕРНЫЙ СЮЖЕТ' : quest.state?.status === 'active' ? 'УСТАРЕВШИЙ РЕЖИМ СОВМЕСТИМОСТИ' : state?.status === 'active' ? 'ОЖИДАЕМ ОТВЕТ СЕРВЕРА' : 'БУНКЕР НЕ ЗАПУЩЕН'}</small>
        </article>
      </div>

      {dashboard && (
        <section className="admin-bunker-wagons" aria-labelledby="admin-bunker-wagons-title">
          <header>
            <div>
              <p className="eyebrow">СОСТАВ</p>
              <h3 id="admin-bunker-wagons-title">ВАГОННАЯ СХЕМА</h3>
            </div>
            {!dashboard.event.compositionLocked && <strong>РЕКОМЕНДАЦИЯ · {recommendedWagonCount} ВАГОНА</strong>}
          </header>

          {!dashboard.event.compositionLocked && (
            <div className="admin-bunker-distribution-controls">
              <label>
                <span>Количество вагонов</span>
                <select
                  value={selectedWagonCount}
                  onChange={(event) => {
                    setManuallySelected(true);
                    setSelectedWagonCount(Number(event.target.value) as SupportedCarriageCount);
                  }}
                >
                  {SUPPORTED_WAGON_COUNTS.map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </label>
              {onAcceptDistribution && (
                <button
                  type="button"
                  className="admin-bunker-primary"
                  disabled={distributionBusy}
                  onClick={() => void acceptDistribution()}
                >
                  {distributionBusy ? 'ПРИМЕНЯЕМ СХЕМУ…' : `ПРИНЯТЬ СХЕМУ · ${selectedWagonCount} ВАГОНА`}
                </button>
              )}
            </div>
          )}

          {manuallySelected && selectedWagonCount !== recommendedWagonCount && (
            <p className="admin-bunker-manual-warning" role="status">
              ВЫБРАНО ВРУЧНУЮ · {selectedWagonCount}. РЕКОМЕНДАЦИЯ · {recommendedWagonCount}. Проверьте размер команд перед фиксацией.
            </p>
          )}

          <ul className="admin-bunker-wagon-list" aria-label="Сводка по вагонам" data-count={wagonSummary.length}>
            {wagonSummary.map((wagon, index) => (
              <li key={wagon.id}>
                <span>{dashboard.event.compositionLocked ? 'АКТИВНЫЙ ВАГОН' : `ПРЕДВАРИТЕЛЬНО · ${index + 1}/${wagonSummary.length}`}</span>
                <strong>{wagon.label}</strong>
                <b>{wagon.count} {wagon.count === 1 ? 'ГОСТЬ' : 'ГОСТЕЙ'}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="admin-bunker-tv" aria-labelledby="admin-bunker-tv-title">
        <header>
          <div>
            <p className="eyebrow">ЭКРАНЫ</p>
            <h3 id="admin-bunker-tv-title">ТВ · {deps.subscribeScreenPresence ? presenceSummary.connectedCount : 'Н/Д'} ОНЛАЙН</h3>
          </div>
          <span>{deps.subscribeScreenPresence ? 'LIVE HEARTBEAT' : 'ТЕЛЕМЕТРИЯ НЕ ПОДКЛЮЧЕНА'}</span>
        </header>
        {screenPresence.length > 0 ? (
          <ul aria-label="Подключенные ТВ">
            {screenPresence.map((screen) => {
              const ageMs = Math.max(0, presenceNowMs - screen.receivedAt);
              const ageSeconds = Math.floor(ageMs / 1_000);
              const online = ageMs <= PREMIERE_SCREEN_PRESENCE_TTL_MS;
              const readiness = `${screen.videoReady ? 'ВИДЕО ГОТОВО' : 'ВИДЕО НЕ ГОТОВО'} · ${screen.audioArmed ? 'ЗВУК ГОТОВ' : 'ЗВУК НЕ ГОТОВ'}`;
              return (
                <li key={screen.screenId} aria-label={screen.screenId}>
                  <div>
                    <strong>{screen.screenId}</strong>
                    <span>{online ? 'ОНЛАЙН' : 'НЕ В СЕТИ'}</span>
                  </div>
                  {online ? (
                    <p>{readiness}</p>
                  ) : (
                    <div className="admin-bunker-tv__stale">
                      <strong>НЕИЗВЕСТНО СЕЙЧАС</strong>
                      <p>ПОСЛЕДНИЕ ДАННЫЕ · {readiness}</p>
                    </div>
                  )}
                  <time>ПОСЛЕДНИЙ СИГНАЛ · {ageSeconds} С НАЗАД</time>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="admin-bunker-tv__empty">
            {deps.subscribeScreenPresence ? 'ТВ НЕ В СЕТИ · СИГНАЛОВ HEARTBEAT ПОКА НЕТ' : 'СПИСОК ТВ НЕДОСТУПЕН В ЭТОЙ КОНФИГУРАЦИИ'}
          </p>
        )}
      </section>

      <section className="admin-bunker-stage" aria-label="Текущий этап Бункера">
        <span>ТЕКУЩИЙ ЭТАП · {currentStage}</span>
        <p>
          {state?.status === 'active'
            ? globalState
              ? 'Телефоны и ТВ синхронизированы. Следуйте серверному сюжету и сценарию ведущего ниже.'
              : 'Работает режим совместимости со старым квестом. Не запускайте параллельно новый серверный сюжет.'
            : 'После запуска ТВ покажут первое экстренное сообщение, а команды получат пролог на телефонах.'}
        </p>

      {state?.status === 'active' ? (
        null
      ) : armed ? (
        <div className="admin-bunker-confirm" role="alert">
          <strong>ВСЕ ЭКРАНЫ ПЕРЕКЛЮЧАТСЯ СРАЗУ</strong>
          <p>Проверьте, что ведущий готов и это нужный момент сценария.</p>
          <div>
            <button
              type="button"
              className="admin-bunker-launch"
              disabled={busy}
              onClick={() => void launch()}
            >
              {busy ? 'ЗАПУСКАЕМ…' : 'ЗАПУСТИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ · 30:00'}
            </button>
            <button type="button" className="registration-secondary" disabled={busy} onClick={() => setArmed(false)}>
              ОТМЕНА
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="admin-bunker-primary"
          onClick={() => setArmed(true)}
        >
          ПОДГОТОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ
        </button>
      )}

      </section>

      {state?.status === 'active' && globalState && (
        <section className="admin-bunker-stage" aria-label="Авторитетный сюжет Бункера">
          <span>СЕРВЕРНЫЙ СЮЖЕТ</span>
          <h3>{GLOBAL_STATE_LABELS[globalState]}</h3>
          <p>
            {state.currentMission
              ? `Текущая миссия синхронизирована: ${state.currentMission.id}.`
              : 'Межмиссионный этап синхронизирован со всеми телефонами и ТВ.'}
          </p>
          {missionProgress && (
            <p className="admin-bunker-stage__progress" role="status">
              <strong>{missionProgress.completedWagons} / {missionProgress.totalWagons} ВАГОНА ГОТОВЫ</strong>
              <span>{missionProgress.complete ? 'МОЖНО ПЕРЕХОДИТЬ ДАЛЬШЕ' : 'ДОЖДИТЕСЬ ОСТАЛЬНЫХ ВАГОНОВ'}</span>
            </p>
          )}
          {missionProgress?.complete === false
            && deps.forceCompleteMission
            && activeWagons.length > 0 && (
            <div className="admin-bunker-stage__recovery">
              <strong>ВОССТАНОВЛЕНИЕ ПРИ СЛОМАННОМ ТЕЛЕФОНЕ</strong>
              <p>Используйте только после устного подтверждения решения конкретного вагона.</p>
              <div>
                {activeWagons.map((wagon) => (
                  <button
                    key={wagon.id}
                    type="button"
                    className="registration-secondary"
                    disabled={busy}
                    onClick={() => setPendingForceWagon({ id: wagon.id, label: wagon.label })}
                  >
                    ПОМЕТИТЬ ГОТОВЫМ · {wagon.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {pendingForceWagon && (
            <div className="admin-bunker-confirm" role="alert">
              <strong>ПРИНУДИТЕЛЬНО ЗАВЕРШИТЬ ЭТАП?</strong>
              <p>{pendingForceWagon.label}: система отметит миссию готовой без отправки с телефона.</p>
              <div>
                <button type="button" className="admin-bunker-launch" disabled={busy} onClick={() => void confirmForceWagon()}>
                  ПОДТВЕРДИТЬ ГОТОВНОСТЬ ВАГОНА
                </button>
                <button type="button" className="registration-secondary" disabled={busy} onClick={() => setPendingForceWagon(null)}>
                  ОТМЕНА
                </button>
              </div>
            </div>
          )}
          {nextGlobalState && advanceGlobalState && (
            <>
              <button
                type="button"
                className="admin-bunker-stage-primary"
                disabled={busy || missionTransitionBlocked || finalOpeningLocked}
                onClick={() => setPendingGlobalState(nextGlobalState.state)}
              >
                {nextGlobalState.label}
              </button>
              {finalOpeningLocked && (
                <p className="admin-bunker-stage__unlock-note" role="status">
                  Штатное открытие станет доступно после правильного финального кода.
                </p>
              )}
            </>
          )}
          {nextGlobalState && pendingGlobalState === nextGlobalState.state && (
            <div className="admin-bunker-confirm" role="alert">
              <strong>ПЕРЕКЛЮЧИТЬ ВСЕ ТЕЛЕФОНЫ И ТВ?</strong>
              <p>
                Следующий этап: {GLOBAL_STATE_LABELS[nextGlobalState.state]}. Убедитесь, что прочитали сценарий и все вагоны закончили текущую задачу.
              </p>
              <div>
                <button
                  type="button"
                  className="admin-bunker-launch"
                  disabled={busy}
                  onClick={() => void confirmGlobalTransition()}
                >
                  ПОДТВЕРДИТЬ ПЕРЕХОД
                </button>
                <button
                  type="button"
                  className="registration-secondary"
                  disabled={busy}
                  onClick={() => setPendingGlobalState(null)}
                >
                  ОТМЕНА
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {state?.status === 'active' && (
        <BunkerHostRunbook
          mission={state.currentMission?.id ?? globalState}
          plan={state.currentMission?.plan}
        />
      )}

      {state && (
        <label className="admin-bunker-sound">
          <input
            type="checkbox"
            checked={state.soundEnabled}
            disabled={busy}
            onChange={(event: ChangeEvent<HTMLInputElement>) => void run(() => deps.setSound(eventId, event.target.checked))}
          />
          <span>ТРЕВОЖНЫЙ ЗВУК НА ТВ</span>
        </label>
      )}

      {state?.status === 'active' && !globalState && quest.state?.status === 'active' && (
        <BunkerQuestOwnerPanel
          state={quest.state}
          busy={quest.busy}
          onBegin={() => void quest.begin()}
          onAdvance={(phase) => void quest.advance(phase)}
          onReset={(carriageId, stage) => void quest.resetStage(carriageId, stage)}
          onForce={(carriageId, stage) => void quest.forceStage(carriageId, stage)}
          onUnlock={() => void quest.unlock()}
        />
      )}

      {state?.status === 'active' && characters.length > 0 && (
        <section className="admin-bunker-characters" aria-labelledby="admin-bunker-characters-title">
          <header>
            <p className="eyebrow">СЮЖЕТНЫЕ СТАТУСЫ</p>
            <h3 id="admin-bunker-characters-title">ПЕРСОНАЖИ ТЕКУЩЕГО RUN</h3>
          </header>
          <ul aria-label="Статусы персонажей">
            {characters.map((character) => (
              <li
                key={character.guestId}
                aria-label={`${character.realName} · ${character.profession}`}
              >
                <div>
                  <strong>{character.realName}</strong>
                  <span>{character.profession} · {character.wagon.label}</span>
                  {character.joinedLate && <small>ПОЗДНЕЕ ПРИСОЕДИНЕНИЕ</small>}
                </div>
                <div role="group" aria-label={`Статус · ${character.realName}`}>
                  {([
                    ['active', 'АКТИВЕН'],
                    ['saved', 'СПАСЁН'],
                    ['excluded', 'ИСКЛЮЧЁН'],
                  ] as const).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={character.characterStatus === status}
                      disabled={characterBusy === character.guestId}
                      onClick={() => void updateCharacterStatus(character, status)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state?.status === 'active' && (
        <section className="admin-bunker-danger" aria-labelledby="admin-bunker-danger-title">
          <div>
            <p className="eyebrow">ПОДТВЕРЖДАЕМАЯ ЗОНА</p>
            <h3 id="admin-bunker-danger-title">ОПАСНЫЕ КОМАНДЫ</h3>
          </div>
          <p>Эти действия немедленно меняют состояние всех экранов. Каждое требует отдельного подтверждения.</p>
          {globalState === 'FINAL_30' && finalOpeningLocked && deps.forceOpen && (
            <section
              className="admin-bunker-final-recovery"
              aria-labelledby="admin-bunker-final-recovery-title"
            >
              <div>
                <p className="eyebrow">ТОЛЬКО ПРИ ТЕХНИЧЕСКОМ СБОЕ</p>
                <h4 id="admin-bunker-final-recovery-title">Аварийное открытие Бункера</h4>
              </div>
              <p id="admin-bunker-final-recovery-help">
                Обходит только финальный код. Причина и owner сохраняются в журнале действий.
              </p>
              <label htmlFor="admin-bunker-final-recovery-reason">
                <span>Причина аварийного открытия</span>
                <textarea
                  id="admin-bunker-final-recovery-reason"
                  value={forceOpenReason}
                  minLength={12}
                  rows={2}
                  aria-describedby="admin-bunker-final-recovery-help admin-bunker-final-recovery-count"
                  onChange={(event) => setForceOpenReason(event.target.value)}
                />
              </label>
              <small id="admin-bunker-final-recovery-count">
                {forceOpenReason.trim().length} / минимум 12 символов
              </small>
              <label htmlFor="admin-bunker-final-recovery-confirmation">
                <span>Контрольная фраза</span>
                <input
                  id="admin-bunker-final-recovery-confirmation"
                  value={forceOpenConfirmation}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={FORCE_OPEN_CONFIRMATION}
                  aria-describedby="admin-bunker-final-recovery-phrase"
                  onChange={(event) => setForceOpenConfirmation(event.target.value)}
                />
              </label>
              <small id="admin-bunker-final-recovery-phrase">
                Введите без кавычек: <code>{FORCE_OPEN_CONFIRMATION}</code>
              </small>
              <button
                type="button"
                className="admin-bunker-stop"
                disabled={busy || !forceOpenReady}
                onClick={() => void confirmForceOpen()}
              >
                ОТКРЫТЬ БУНКЕР ПРИНУДИТЕЛЬНО
              </button>
            </section>
          )}
          <div className="admin-bunker-control__actions">
            <button
              type="button"
              className="registration-secondary"
              disabled={busy}
              onClick={() => setDangerCommand('restart')}
            >
              ПЕРЕЗАПУСТИТЬ 30:00
            </button>
            <button
              type="button"
              className="admin-bunker-stop"
              disabled={busy}
              onClick={() => setDangerCommand('stop')}
            >
              ОСТАНОВИТЬ БУНКЕР
            </button>
          </div>

          {dangerCommand && (
            <div className="admin-bunker-confirm" role="alert">
              <strong>{dangerCommand === 'stop' ? 'ОСТАНОВИТЬ ЭКСТРЕННОЕ СООБЩЕНИЕ?' : 'ПЕРЕЗАПУСТИТЬ ТАЙМЕР БУНКЕРА?'}</strong>
              <p>{dangerCommand === 'stop' ? 'ТВ вернутся из режима Бункера.' : 'Общий таймер на всех экранах снова станет 30:00.'}</p>
              <div>
                <button
                  type="button"
                  className="admin-bunker-launch"
                  disabled={busy}
                  onClick={() => void confirmDangerCommand()}
                >
                  {dangerCommand === 'stop' ? 'ПОДТВЕРДИТЬ ОСТАНОВКУ' : 'ПОДТВЕРДИТЬ ПЕРЕЗАПУСК'}
                </button>
                <button type="button" className="registration-secondary" disabled={busy} onClick={() => setDangerCommand(null)}>
                  ОТМЕНА
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {quest.error && <p className="admin-bunker-error" role="alert">{quest.error}</p>}
      {quest.warning && <p className="admin-bunker-error" role="status">{quest.warning}</p>}
      {refreshError && <p className="admin-bunker-error" role="alert">{refreshError}</p>}
      {error && <p className="admin-bunker-error" role="alert">{error}</p>}
    </section>
  );
}
