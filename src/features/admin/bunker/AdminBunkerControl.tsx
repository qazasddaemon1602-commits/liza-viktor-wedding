import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../lib/supabase';
import type { AdminDashboard } from '../admin.service';
import {
  balancedCarriageSizes,
  recommendCarriageCount,
  type SupportedCarriageCount,
} from '../../carriages/carriageAllocator';
import {
  broadcastBunkerRefresh,
  type BunkerRealtimeClient,
} from '../../bunker/bunker.realtime';
import {
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
import {
  MissionOneOwnerPanel,
  type MissionOneOwnerOverride,
  type MissionOneOwnerReadModel,
} from './MissionOneOwnerPanel';

export type AdminBunkerControlDependencies = {
  load: (eventId: string) => Promise<OwnerBunkerControl>;
  prepare: (eventId: string, gameMode: 'production') => Promise<PreparedBunkerGame>;
  distribute: (eventId: string) => Promise<DistributedBunkerCharacters>;
  advance?: (
    eventId: string,
    nextState: BunkerGlobalGameState,
  ) => Promise<AdvancedBunkerGameState>;
  loadCharacters?: (eventId: string) => Promise<OwnerBunkerCharacters>;
  setCharacterStatus?: (
    eventId: string,
    guestId: string,
    status: BunkerCharacterStatus,
  ) => Promise<UpdatedBunkerCharacterStatus>;
  start: (eventId: string, durationSeconds: number) => Promise<unknown>;
  stop: (eventId: string) => Promise<unknown>;
  setSound: (eventId: string, enabled: boolean) => Promise<unknown>;
  broadcastRefresh: () => Promise<void>;
  subscribeScreenPresence?: (callback: (presence: PremiereScreenPresence) => void) => () => void;
};

type AdminBunkerControlProps = {
  eventId: string;
  dependencies?: AdminBunkerControlDependencies;
  dashboard?: AdminDashboard;
  onAcceptDistribution?: (carriageCount: SupportedCarriageCount) => Promise<void> | void;
  questDependencies?: OwnerBunkerQuestDependencies;
  missionOne?: MissionOneOwnerReadModel;
  onMissionOneOverride?: (override: MissionOneOwnerOverride) => Promise<void> | void;
  bunkerContractVersion?: 1 | 2;
};

const SUPPORTED_WAGON_COUNTS: SupportedCarriageCount[] = [2, 3, 4, 5];

function browserDependencies(): AdminBunkerControlDependencies | null {
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
      loadCharacters: (eventId) => getOwnerBunkerCharacters(rpcClient, eventId),
      setCharacterStatus: (eventId, guestId, status) => (
        setOwnerBunkerCharacterStatus(rpcClient, eventId, guestId, status)
      ),
      start: (eventId, durationSeconds) => startBunker(rpcClient, eventId, durationSeconds),
      stop: (eventId) => stopBunker(rpcClient, eventId),
      setSound: (eventId, enabled) => setBunkerSound(rpcClient, eventId, enabled),
      broadcastRefresh: () => broadcastBunkerRefresh(realtimeClient, 'liza-viktor'),
      subscribeScreenPresence: (callback) => subscribeToPremiereScreenPresence(
        presenceClient,
        'liza-viktor',
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
  LOBBY: 'ПОДГОТОВКА ИГРЫ',
  CHARACTERS_READY: 'ГОТОВНОСТЬ ПЕРСОНАЖЕЙ',
  MISSION_01: 'МИССИЯ 01',
  BREAK: 'ПЕРЕРЫВ',
  MISSION_02: 'МИССИЯ 02',
  MISSION_03: 'МИССИЯ 03',
  MISSION_04: 'МИССИЯ 04',
  MISSION_05: 'МИССИЯ 05',
  MISSION_06: 'МИССИЯ 06',
  STORY_BUNKER: 'ИСТОРИЯ БУНКЕРА',
  BREAK_BEFORE_FINAL: 'ПЕРЕРЫВ ПЕРЕД ФИНАЛОМ',
  FINAL_30: 'ФИНАЛ · 30 МИНУТ',
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

class BunkerCommandFailure extends Error {
  constructor(readonly stage: string, cause: unknown) {
    const detail = cause instanceof Error && cause.message.trim()
      ? cause.message.trim().slice(0, 180)
      : 'сервер отклонил команду';
    super(`${stage}: ${detail}`);
  }
}

export function AdminBunkerControl({
  eventId,
  dependencies,
  dashboard,
  onAcceptDistribution,
  questDependencies,
  missionOne,
  onMissionOneOverride,
  bunkerContractVersion = 1,
}: AdminBunkerControlProps) {
  const deps = useMemo(() => dependencies ?? browserDependencies(), [dependencies]);
  const [state, setState] = useState<OwnerBunkerControl | null>(null);
  const [armed, setArmed] = useState(false);
  const [dangerCommand, setDangerCommand] = useState<'restart' | 'stop' | null>(null);
  const [busy, setBusy] = useState(false);
  const [distributionBusy, setDistributionBusy] = useState(false);
  const recommendedWagonCount = recommendCarriageCount(dashboard?.guests.length ?? 0);
  const [selectedWagonCount, setSelectedWagonCount] = useState<SupportedCarriageCount>(recommendedWagonCount);
  const [manuallySelected, setManuallySelected] = useState(false);
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState<OwnerBunkerCharacter[]>([]);
  const [characterBusy, setCharacterBusy] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [presenceNowMs, setPresenceNowMs] = useState(() => Date.now());
  const [screenPresence, setScreenPresence] = useState<PremiereScreenPresenceRecord[]>([]);
  const serverOffsetRef = useRef(0);
  const quest = useOwnerBunkerQuestState(eventId, {
    dependencies: questDependencies,
    enabled: state?.status === 'active' && (!dependencies || Boolean(questDependencies)),
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

  const storeState = (next: OwnerBunkerControl) => {
    const receivedAt = Date.now();
    const serverMs = Date.parse(next.serverNow);
    serverOffsetRef.current = Number.isFinite(serverMs) ? serverMs - receivedAt : 0;
    setNowMs(receivedAt);
    setState(next);
  };

  const reload = async () => {
    if (!deps) return;
    const next = await deps.load(eventId);
    storeState(next);
    return next;
  };

  useEffect(() => {
    if (!deps) return;
    let active = true;
    void deps.load(eventId)
      .then((next) => {
        if (active) storeState(next);
      })
      .catch(() => {
        if (active) setError('Не удалось проверить статус Бункера.');
      });
    return () => {
      active = false;
    };
  }, [deps, eventId]);

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
          state.durationSeconds
          - (nowMs + serverOffsetRef.current - Date.parse(state.startedAt)) / 1000,
        ),
      )
    : 0;

  const run = async (command: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      try {
        await command();
      } catch (commandError) {
        if (commandError instanceof BunkerCommandFailure
          && commandError.stage === 'ЭТАП ЗАПУСКА НА ТВ') {
          try {
            const authoritative = await reload();
            if (authoritative?.status === 'active') {
              setError('Ответ запуска потерян, но статус перечитан · БУНКЕР АКТИВЕН. Повторный запуск не нужен.');
              return;
            }
          } catch {
            // Keep the stage-specific failure below when the authoritative read also fails.
          }
        }
        const detail = commandError instanceof BunkerCommandFailure
          ? commandError.message
          : 'КОМАНДА БУНКЕРА: проверьте связь и owner-сессию';
        setError(`Не выполнено · ${detail}. Повторный запуск не отправлен.`);
        return;
      }

      let warning = '';
      try {
        await deps.broadcastRefresh();
      } catch {
        warning = 'Команда выполнена. Realtime-сигнал не отправлен — ТВ подхватят состояние автоматически.';
      }

      try {
        await reload();
      } catch {
        warning = warning || 'Команда выполнена, но не удалось перечитать статус. Не нажимайте повторно — проверьте связь.';
      }

      setError(warning);
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    await run(async () => {
      let prepared: PreparedBunkerGame;
      try {
        prepared = await deps.prepare(eventId, 'production');
      } catch (cause) {
        throw new BunkerCommandFailure('ЭТАП ПОДГОТОВКИ', cause);
      }
      if (prepared.globalGameState === 'LOBBY') {
        try {
          await deps.distribute(eventId);
        } catch (cause) {
          throw new BunkerCommandFailure('ЭТАП РАСПРЕДЕЛЕНИЯ ПЕРСОНАЖЕЙ', cause);
        }
      }
      try {
        await deps.start(eventId, 1800);
      } catch (cause) {
        throw new BunkerCommandFailure('ЭТАП ЗАПУСКА НА ТВ', cause);
      }
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

  const confirmDangerCommand = async () => {
    if (dangerCommand === 'restart') {
      await run(() => deps.start(eventId, 1800));
    } else if (dangerCommand === 'stop') {
      await run(() => deps.stop(eventId));
    }
    setDangerCommand(null);
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
        await deps.broadcastRefresh();
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
          <small>{quest.state?.status === 'active' ? 'СЕРВЕРНОЕ СОСТОЯНИЕ' : state?.status === 'active' ? 'ОЖИДАЕМ ОТВЕТ СЕРВЕРА' : 'БУНКЕР НЕ ЗАПУЩЕН'}</small>
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
        <p>Все ТВ переключатся на «ЭКСТРЕННОЕ СООБЩЕНИЕ», маршрут изменится на Бункер и запустится общий таймер 30:00.</p>

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
          {nextGlobalState && advanceGlobalState && (
            <button
              type="button"
              className="admin-bunker-stage-primary"
              disabled={busy}
              onClick={() => void run(() => advanceGlobalState(eventId, nextGlobalState.state))}
            >
              {nextGlobalState.label}
            </button>
          )}
        </section>
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

      {state?.status === 'active' && quest.state?.status === 'active' && (
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

      {state?.status === 'active' && globalState === 'MISSION_01' && missionOne && (
        <MissionOneOwnerPanel model={missionOne} onOverride={onMissionOneOverride} />
      )}

      {state?.status === 'active'
        && bunkerContractVersion === 1
        && globalState !== 'MISSION_01'
        && characters.length > 0 && (
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
      {error && <p className="admin-bunker-error" role="alert">{error}</p>}
    </section>
  );
}
